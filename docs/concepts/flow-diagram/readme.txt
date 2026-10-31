Below is a Graphviz DOT diagram of a rail transfer network.
- A and B are origin stations on Line A and Line B.
- C1 and C2 are the same interchange, with one node per line.
- C1->C2 and C2->C1 are transfer movements between lines.
- C1->E and C2->F are the onward legs.
Each edge will carry passenger flow, to be shown as penwidth.

[paste DOT here]


digraph TransferFlows {
  rankdir=TB;
  splines=line;
  nodesep=1.0;
  ranksep=1.1;

  node [shape=box, style="filled,rounded", fontname="Helvetica-Bold", fontsize=16, fontcolor="white",
        fillcolor="#1f5f84", color="#0d2f45", penwidth=2, margin="0.35,0.12", width=0.9];
  edge [color="#1f5f84", arrowsize=0.8, fontname="Helvetica", fontsize=11];

  A;  B;  E;  F;
  C1 [label="C"];  // Line A platform at C
  C2 [label="C"];  // Line B platform at C

  { rank=same; A; B; }
  { rank=same; C1; C2; }
  { rank=same; E; F; }

  // On-line legs
  A  -> C1 [edge_type=line, flow=1200, penwidth=12,  label="1200"];
  C1 -> E  [edge_type=line, flow=700,  penwidth=7,   label="700"];
  B  -> C2 [edge_type=line, flow=900,  penwidth=9,   label="900"];
  C2 -> F  [edge_type=line, flow=800,  penwidth=8,   label="800"];

  // Transfers (orange to separate them from line travel)
  C1 -> C2 [edge_type=transfer, flow=300, penwidth=3,   label="300", color="#dd6b20",
            constraint=false, tailport=ne, headport=nw];
  C2 -> C1 [edge_type=transfer, flow=150, penwidth=1.5, label="150", color="#dd6b20",
            constraint=false, tailport=sw, headport=se];
}