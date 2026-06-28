from langgraph.graph import END, START, StateGraph

from agents.nodes.crawler import crawler
from agents.nodes.delivery import deliver
from agents.nodes.filter import filter_articles
from agents.nodes.load_profile import load_profile
from agents.nodes.store_raw import store_raw
from agents.nodes.synthesis import synthesize
from agents.state import PipelineState


def build_graph():
    graph = StateGraph(PipelineState)

    graph.add_node("load_profile", load_profile)
    graph.add_node("crawler", crawler)
    graph.add_node("store_raw", store_raw)
    graph.add_node("filter", filter_articles)
    graph.add_node("synthesis", synthesize)
    graph.add_node("delivery", deliver)

    graph.add_edge(START, "load_profile")
    graph.add_edge("load_profile", "crawler")
    graph.add_edge("crawler", "store_raw")
    graph.add_edge("store_raw", "filter")
    graph.add_edge("filter", "synthesis")
    graph.add_edge("synthesis", "delivery")
    graph.add_edge("delivery", END)

    return graph.compile()
