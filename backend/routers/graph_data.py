"""
Graph Data Router — GET /api/v1/graph-data

Returns the full graph (or filtered subset) in a Cytoscape.js-compatible
JSON format: { nodes: [...], edges: [...] }.
"""

from typing import Optional

from fastapi import APIRouter, HTTPException, Query, Request

router = APIRouter(prefix="/api/v1", tags=["Graph Data"])


@router.get(
    "/graph-data",
    summary="Query the graph for visualisation",
    description=(
        "Returns all nodes and edges in the graph formatted for Cytoscape.js. "
        "Optionally filter by node type (UserAccount, Transaction, IPAddress, "
        "DeviceFingerprint, CyberAlert)."
    ),
)
async def get_graph_data(
    request: Request,
    node_type: Optional[str] = Query(
        None,
        description="Filter nodes by type (e.g. UserAccount, CyberAlert)",
    ),
):
    store = request.app.state.store
    if store is None:
        raise HTTPException(
            status_code=503,
            detail="Graph store not available (real Neo4j mode not yet supported for this endpoint).",
        )

    graph = store.to_cytoscape()

    # Optional filtering by node type
    if node_type:
        graph["nodes"] = [
            n for n in graph["nodes"]
            if n["data"].get("type", "").lower() == node_type.lower()
        ]
        # Keep only edges where both source and target are still in the filtered set
        node_ids = {n["data"]["id"] for n in graph["nodes"]}
        graph["edges"] = [
            e for e in graph["edges"]
            if e["data"]["source"] in node_ids or e["data"]["target"] in node_ids
        ]

    return {
        "nodes": graph["nodes"],
        "edges": graph["edges"],
        "meta": {
            "total_nodes": len(graph["nodes"]),
            "total_edges": len(graph["edges"]),
            "filter": node_type,
        },
    }


@router.get(
    "/graph-data/stats",
    summary="Graph statistics",
    description="Returns aggregate counts of nodes and edges by type.",
)
async def get_graph_stats(request: Request):
    store = request.app.state.store
    if store is None:
        raise HTTPException(status_code=503, detail="Graph store not available.")

    graph = store.to_cytoscape()

    node_counts: dict[str, int] = {}
    for n in graph["nodes"]:
        t = n["data"].get("type", "Unknown")
        node_counts[t] = node_counts.get(t, 0) + 1

    edge_counts: dict[str, int] = {}
    for e in graph["edges"]:
        t = e["data"].get("type", "Unknown")
        edge_counts[t] = edge_counts.get(t, 0) + 1

    return {
        "total_nodes": len(graph["nodes"]),
        "total_edges": len(graph["edges"]),
        "nodes_by_type": node_counts,
        "edges_by_type": edge_counts,
    }
