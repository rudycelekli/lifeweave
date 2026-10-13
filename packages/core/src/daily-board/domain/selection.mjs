const order=(a,b)=>b.priority-a.priority||b.confidence-a.confidence||(a.id<b.id?-1:a.id>b.id?1:0);

/** Breadth is an explicit presentation choice, never a score of someone's life. */
export function selectCurrentMoves(surfaces,limit) {
  const sorted=[...surfaces].sort(order),selected=[],goals=new Set(),ids=new Set();
  for(const surface of sorted) {
    if(selected.length===limit)break;
    if(goals.has(surface.goalId)||ids.has(surface.id))continue;
    selected.push(surface);goals.add(surface.goalId);ids.add(surface.id);
  }
  for(const surface of sorted) {
    if(selected.length===limit)break;
    if(!ids.has(surface.id)){selected.push(surface);ids.add(surface.id);}
  }
  return selected;
}
