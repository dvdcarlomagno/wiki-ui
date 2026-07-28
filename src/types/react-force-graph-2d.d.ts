declare module "react-force-graph-2d" {
  import type { ComponentType, Ref } from "react";

  type NodeObject = {
    id?: string | number;
    x?: number;
    y?: number;
    vx?: number;
    vy?: number;
    name?: string;
    [key: string]: unknown;
  };

  type LinkObject = {
    source?: string | number | NodeObject;
    target?: string | number | NodeObject;
    [key: string]: unknown;
  };

  export type ForceGraphMethods = {
    centerAt: (x?: number, y?: number, ms?: number) => void;
    zoom: (scale?: number, ms?: number) => void;
    zoomToFit: (ms?: number, padding?: number) => void;
  };

  type ForceGraphProps = {
    ref?: Ref<ForceGraphMethods>;
    width?: number;
    height?: number;
    graphData?: { nodes: NodeObject[]; links: LinkObject[] };
    nodeLabel?: string | ((node: NodeObject) => string);
    nodeRelSize?: number;
    nodeColor?: string | ((node: NodeObject) => string);
    linkColor?: string | ((link: LinkObject) => string);
    linkWidth?: number | ((link: LinkObject) => number);
    linkDirectionalParticles?: number | ((link: LinkObject) => number);
    linkDirectionalParticleWidth?: number | ((link: LinkObject) => number);
    backgroundColor?: string;
    cooldownTicks?: number;
    onNodeClick?: (node: NodeObject, event: MouseEvent) => void;
    onBackgroundClick?: (event: MouseEvent) => void;
    nodeCanvasObject?: (
      node: NodeObject,
      ctx: CanvasRenderingContext2D,
      globalScale: number,
    ) => void;
    nodeCanvasObjectMode?: string | ((node: NodeObject) => string);
  };

  const ForceGraph2D: ComponentType<ForceGraphProps>;
  export default ForceGraph2D;
}
