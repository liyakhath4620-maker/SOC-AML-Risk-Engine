"""
Mock Neo4j Driver — In-memory graph store for demo/prototype mode.

Provides the same API surface as neo4j.Driver so that the rest of the
application can run without a real Neo4j instance.  All data is held
in Python dicts and lost when the process exits.
"""

import logging
import re
from datetime import datetime

logger = logging.getLogger(__name__)


class MockRecord:
    """Mimics a neo4j.Record for query results."""

    def __init__(self, data: dict):
        self._data = data

    def data(self):
        return self._data

    def __getitem__(self, key):
        return self._data[key]

    def get(self, key, default=None):
        return self._data.get(key, default)


class MockResult:
    """Mimics a neo4j.Result."""

    def __init__(self, records: list[dict] | None = None):
        self._records = [MockRecord(r) for r in (records or [])]
        self._idx = 0

    def __iter__(self):
        return iter(self._records)

    def __next__(self):
        if self._idx >= len(self._records):
            raise StopIteration
        rec = self._records[self._idx]
        self._idx += 1
        return rec

    def single(self):
        return self._records[0] if self._records else None

    def data(self):
        return [r.data() for r in self._records]


class _MockTransaction:
    """Wraps the store so write-transaction lambdas receive a `tx` object."""

    def __init__(self, store: "MockGraphStore"):
        self._store = store

    def run(self, query: str, parameters: dict | None = None):
        return self._store.execute(query, parameters or {})


class MockGraphStore:
    """Central in-memory graph store used by MockSession."""

    def __init__(self):
        self.nodes: dict[str, dict] = {}        # key = "Label:id_value"
        self.relationships: list[dict] = []      # list of relationship dicts
        self._ingested_records: list[dict] = []  # raw records for convenience

    # ------------------------------------------------------------------ #
    #  Execute — lightweight Cypher interpretation (covers project needs) #
    # ------------------------------------------------------------------ #
    def execute(self, query: str, params: dict) -> MockResult:
        q = query.strip().upper()

        # Schema DDL — silently accept
        if q.startswith("CREATE CONSTRAINT") or q.startswith("CREATE INDEX"):
            return MockResult()

        # MERGE-based ingestion queries — store the params as nodes/rels
        if "MERGE" in q:
            self._handle_merge(query, params)
            return MockResult()

        # MATCH-based read queries — return stored data
        if "MATCH" in q:
            return self._handle_match(query, params)

        return MockResult()

    # ------------------------------------------------------------------ #
    #  MERGE handler — extract node labels and properties from params     #
    # ------------------------------------------------------------------ #
    def _handle_merge(self, query: str, params: dict):
        # --- nodes ---
        merge_node_re = re.compile(
            r"MERGE\s*\((\w+):(\w+)\s*\{(\w+):\s*\$(\w+)\}\)",
            re.IGNORECASE,
        )
        for var, label, key_field, param_name in merge_node_re.findall(query):
            id_val = params.get(param_name)
            if id_val is None:
                continue
            node_key = f"{label}:{id_val}"
            if node_key not in self.nodes:
                self.nodes[node_key] = {"_label": label, key_field: id_val}

            # Absorb SET / ON CREATE SET properties
            node = self.nodes[node_key]
            self._absorb_properties(node, label, var, query, params)

        # --- relationships ---
        merge_rel_re = re.compile(
            r"MERGE\s*\((\w+)\)-\[:(\w+)(?:\s*\{[^}]*\})?\]->\((\w+)\)",
            re.IGNORECASE,
        )
        for src_var, rel_type, dst_var in merge_rel_re.findall(query):
            src_label, src_id = self._resolve_var(src_var, query, params)
            dst_label, dst_id = self._resolve_var(dst_var, query, params)
            if src_label and dst_label:
                # Extract relationship properties
                rel_props = self._extract_rel_props(query, rel_type, params)
                rel = {
                    "_type": rel_type,
                    "_src": f"{src_label}:{src_id}",
                    "_dst": f"{dst_label}:{dst_id}",
                    **rel_props,
                }
                # Avoid exact duplicates
                if not any(
                    r["_type"] == rel["_type"]
                    and r["_src"] == rel["_src"]
                    and r["_dst"] == rel["_dst"]
                    for r in self.relationships
                ):
                    self.relationships.append(rel)

    def _absorb_properties(self, node: dict, label: str, var: str, query: str, params: dict):
        """Pick up ON CREATE SET / SET assignments for a node variable."""
        set_re = re.compile(
            rf"{re.escape(var)}\.(\w+)\s*=\s*\$(\w+)",
            re.IGNORECASE,
        )
        for prop, param in set_re.findall(query):
            val = params.get(param)
            if val is not None:
                node[prop] = val

    def _resolve_var(self, var: str, query: str, params: dict):
        """
        Given a Cypher variable name, find its label and primary-key value
        from the MERGE clause that defines it.
        """
        pattern = re.compile(
            rf"MERGE\s*\({re.escape(var)}:(\w+)\s*\{{(\w+):\s*\$(\w+)\}}\)",
            re.IGNORECASE,
        )
        m = pattern.search(query)
        if m:
            label, _key_field, param_name = m.groups()
            return label, params.get(param_name)
        return None, None

    def _extract_rel_props(self, query: str, rel_type: str, params: dict) -> dict:
        """Pull property assignments from a relationship MERGE clause."""
        pattern = re.compile(
            rf"\[:{re.escape(rel_type)}\s*\{{([^}}]+)\}}\]",
            re.IGNORECASE,
        )
        m = pattern.search(query)
        if not m:
            return {}
        props = {}
        for pair in m.group(1).split(","):
            pair = pair.strip()
            kv = pair.split(":")
            if len(kv) == 2:
                key = kv[0].strip()
                val_ref = kv[1].strip()
                if val_ref.startswith("$"):
                    props[key] = params.get(val_ref[1:])
        return props

    # ------------------------------------------------------------------ #
    #  MATCH handler — return all nodes and relationships                 #
    # ------------------------------------------------------------------ #
    def _handle_match(self, query: str, params: dict) -> MockResult:
        """
        Generic MATCH handler — returns all nodes if the query is a
        broad graph fetch, or filters by label/property.
        """
        results = []

        # Return all nodes
        if "RETURN" in query.upper() and ("n" in query or "node" in query.lower()):
            for key, node in self.nodes.items():
                results.append(dict(node))

        # Return all relationships too
        if not results:
            # Full graph query
            for key, node in self.nodes.items():
                results.append({"type": "node", **node})
            for rel in self.relationships:
                results.append({"type": "relationship", **rel})

        return MockResult(results)

    # ------------------------------------------------------------------ #
    #  Convenience: get Cytoscape.js-compatible data                      #
    # ------------------------------------------------------------------ #
    def to_cytoscape(self) -> dict:
        """Return the full graph as Cytoscape.js-compatible JSON."""
        cyto_nodes = []
        cyto_edges = []

        for key, node in self.nodes.items():
            label = node.get("_label", "Unknown")
            # Determine the primary display ID
            display_id = (
                node.get("account_id")
                or node.get("tx_id")
                or node.get("address")
                or node.get("fingerprint_id")
                or node.get("alert_id")
                or key
            )
            display_name = (
                node.get("name")
                or node.get("account_name")
                or node.get("description", "")[:40]
                or display_id
            )
            cyto_nodes.append({
                "data": {
                    "id": key,
                    "label": display_name,
                    "type": label,
                    **{k: v for k, v in node.items() if not k.startswith("_")},
                }
            })

        for idx, rel in enumerate(self.relationships):
            cyto_edges.append({
                "data": {
                    "id": f"e{idx}",
                    "source": rel["_src"],
                    "target": rel["_dst"],
                    "label": rel["_type"],
                    "type": rel["_type"],
                    **{k: v for k, v in rel.items() if not k.startswith("_")},
                }
            })

        return {"nodes": cyto_nodes, "edges": cyto_edges}


class MockSession:
    """Mimics neo4j.Session — used via `with driver.session() as session:`."""

    def __init__(self, store: MockGraphStore):
        self._store = store
        self._tx = _MockTransaction(store)

    def __enter__(self):
        return self

    def __exit__(self, *args):
        pass

    def run(self, query: str, parameters: dict | None = None):
        return self._store.execute(query, parameters or {})

    def execute_write(self, fn, *args, **kwargs):
        return fn(self._tx, *args, **kwargs)

    def execute_read(self, fn, *args, **kwargs):
        return fn(self._tx, *args, **kwargs)


class MockNeo4jDriver:
    """
    Drop-in replacement for neo4j.GraphDatabase.driver().

    Usage:
        driver = MockNeo4jDriver()
        with driver.session() as session:
            session.run("MERGE ...")
    """

    def __init__(self):
        self.store = MockGraphStore()
        logger.info("MockNeo4jDriver initialised (in-memory mode)")

    def session(self, **kwargs):
        return MockSession(self.store)

    def close(self):
        logger.info("MockNeo4jDriver closed")

    def verify_connectivity(self):
        """No-op — always succeeds."""
        pass
