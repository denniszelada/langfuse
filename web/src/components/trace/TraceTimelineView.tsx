import { Card } from "@/src/components/ui/card";
import { type ObservationReturnType } from "@/src/server/api/routers/traces";
import { isPresent, type APIScore, type Trace } from "@langfuse/shared";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { SimpleTreeView } from "@mui/x-tree-view/SimpleTreeView";
import { TreeItem } from "@mui/x-tree-view/TreeItem";

import {
  MinusIcon,
  PlusIcon,
  PanelRightOpen,
  PlusSquareIcon,
  MinusSquare,
} from "lucide-react";
import { nestObservations } from "@/src/components/trace/lib/helpers";
import { type NestedObservation } from "@/src/utils/types";
import { cn } from "@/src/utils/tailwind";
import { Button } from "@/src/components/ui/button";
import {
  type TreeItemType,
  treeItemColors,
} from "@/src/components/trace/lib/helpers";
import {
  Drawer,
  DrawerContent,
  DrawerTrigger,
} from "@/src/components/ui/drawer";
import { TracePreview } from "@/src/components/trace/TracePreview";
import { ObservationPreview } from "@/src/components/trace/ObservationPreview";
import useSessionStorage from "@/src/components/useSessionStorage";
import { api } from "@/src/utils/api";
import { useIsAuthenticatedAndProjectMember } from "@/src/features/auth/hooks";

// Fixed widths for styling for v1
const SCALE_WIDTH = 800;
const STEP_SIZE = 100;
const CARD_PADDING = 60;
const LABEL_WIDTH = 35;
const MIN_LABEL_WIDTH = 250;
const TREE_INDENTATION = 12; // default in MUI X TreeView

const PREDEFINED_STEP_SIZES = [
  0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20, 25,
  35, 40, 45, 50, 100, 150, 200, 250, 300, 350, 400, 450, 500,
];

const getNestedObservationKeys = (
  observations: NestedObservation[],
): string[] => {
  const keys: string[] = [];

  const collectKeys = (obs: NestedObservation[]) => {
    obs.forEach((observation) => {
      keys.push(`observation-${observation.id}`);
      if (observation.children) {
        collectKeys(observation.children);
      }
    });
  };

  collectKeys(observations);
  return keys;
};

const calculateStepSize = (latency: number, scaleWidth: number) => {
  const calculatedStepSize = latency / (scaleWidth / STEP_SIZE);
  return (
    PREDEFINED_STEP_SIZES.find((step) => step >= calculatedStepSize) ||
    PREDEFINED_STEP_SIZES[PREDEFINED_STEP_SIZES.length - 1]
  );
};

function TreeItemInner({
  latency,
  totalScaleSpan,
  type,
  startOffset = 0,
  firstTokenTimeOffset,
  name,
  children,
  setBackgroundColor,
  level = 0,
  cardWidth,
}: {
  latency?: number;
  totalScaleSpan: number;
  type: TreeItemType;
  startOffset?: number;
  firstTokenTimeOffset?: number;
  name?: string | null;
  children?: React.ReactNode;
  setBackgroundColor: (color: string) => void;
  level?: number;
  cardWidth: number;
}) {
  const itemWidth = ((latency ?? 0) / totalScaleSpan) * SCALE_WIDTH;
  const itemOffsetLabelWidth = itemWidth + startOffset + LABEL_WIDTH;
  const customLabelWidth = cardWidth - SCALE_WIDTH - CARD_PADDING;

  return (
    <div className="group my-0.5 grid w-full min-w-fit grid-cols-[1fr,auto] items-center">
      <div
        className="flex flex-row items-center gap-2"
        style={{
          maxWidth: customLabelWidth - level * TREE_INDENTATION,
          minWidth: MIN_LABEL_WIDTH - LABEL_WIDTH - level * TREE_INDENTATION,
        }}
      >
        <span
          className={cn(
            "rounded-sm px-1 py-0.5 text-xs",
            treeItemColors.get(type),
          )}
        >
          {type}
        </span>
        <span
          className="w-fit-content overflow-hidden text-ellipsis whitespace-nowrap break-all text-sm"
          title={name ?? undefined}
        >
          {name}
        </span>
        <div
          className="w-6 flex-1"
          onClick={(event) => {
            event.stopPropagation();
          }}
        >
          <Drawer
            onOpenChange={(open) => setBackgroundColor(open ? "!bg-muted" : "")}
          >
            <DrawerTrigger asChild>
              <Button
                className="focus:none active:none hidden justify-start hover:!bg-transparent group-hover:block"
                type="button"
                size="xs"
                variant="ghost"
              >
                <PanelRightOpen className="h-4 w-4"></PanelRightOpen>
              </Button>
            </DrawerTrigger>
            <DrawerContent className="overflow-hidden" size="md">
              {children}
            </DrawerContent>
          </Drawer>
        </div>
      </div>
      <div className="flex items-center" style={{ width: `${SCALE_WIDTH}px` }}>
        <div className={`relative w-[${SCALE_WIDTH}px]`}>
          <div className="ml-4 mr-4 h-full border-r-2"></div>
          {firstTokenTimeOffset ? (
            <div className="flex" style={{ marginLeft: `${startOffset}px` }}>
              <div
                className={cn(
                  "flex h-5 items-center justify-end rounded-l-sm border-r border-gray-400 opacity-60",
                  itemWidth
                    ? treeItemColors.get(type)
                    : "border border-dashed bg-muted",
                )}
                style={{
                  width: `${firstTokenTimeOffset - startOffset}px`,
                }}
              >
                <span
                  className={cn(
                    "text text-xs font-light italic text-foreground group-hover:block",
                    firstTokenTimeOffset - startOffset < 30 ? "-mr-14" : "mr-2",
                  )}
                >
                  First token
                </span>
              </div>
              <div
                className={cn(
                  "flex h-5 items-center justify-end rounded-r-sm",
                  itemWidth
                    ? treeItemColors.get(type)
                    : "border border-dashed bg-muted",
                )}
                style={{
                  width: `${itemWidth - (firstTokenTimeOffset - startOffset)}px`,
                }}
              >
                <span
                  className={cn(
                    "hidden justify-end text-xs text-muted-foreground group-hover:block",
                    itemOffsetLabelWidth > SCALE_WIDTH
                      ? "mr-1"
                      : isPresent(latency)
                        ? `-mr-9`
                        : "-mr-6",
                  )}
                >
                  {isPresent(latency) ? `${latency.toFixed(2)}s` : "n/a"}
                </span>
              </div>
            </div>
          ) : (
            <div
              className={cn(
                "flex h-5 items-center justify-end rounded-sm",
                itemWidth
                  ? treeItemColors.get(type)
                  : "border border-dashed bg-muted",
              )}
              style={{
                width: `${itemWidth || 10}px`,
                marginLeft: `${startOffset}px`,
              }}
            >
              <span
                className={cn(
                  "hidden justify-end text-xs text-muted-foreground group-hover:block",
                  itemOffsetLabelWidth > SCALE_WIDTH
                    ? "mr-1"
                    : isPresent(latency)
                      ? `-mr-9`
                      : "-mr-6",
                )}
              >
                {isPresent(latency) ? `${latency.toFixed(2)}s` : "n/a"}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TraceTreeItem({
  observation,
  level = 0,
  traceStartTime,
  totalScaleSpan,
  projectId,
  scores,
  observations,
  cardWidth,
  commentCounts,
}: {
  observation: NestedObservation;
  level: number;
  traceStartTime: Date;
  totalScaleSpan: number;
  projectId: string;
  scores: APIScore[];
  observations: Array<ObservationReturnType>;
  cardWidth: number;
  commentCounts?: Map<string, number>;
}) {
  const { startTime, completionStartTime, endTime } = observation || {};
  const [backgroundColor, setBackgroundColor] = useState("");

  const latency = endTime
    ? (endTime.getTime() - startTime.getTime()) / 1000
    : undefined;
  const startOffset =
    ((startTime.getTime() - traceStartTime.getTime()) / totalScaleSpan / 1000) *
    SCALE_WIDTH;
  const firstTokenTimeOffset = completionStartTime
    ? ((completionStartTime.getTime() - traceStartTime.getTime()) /
        totalScaleSpan /
        1000) *
      SCALE_WIDTH
    : undefined;

  return (
    <TreeItem
      classes={{
        content: `border-l border-dashed !rounded-none ${backgroundColor} !min-w-fit hover:!bg-muted`,
        selected: "!bg-background !important hover:!bg-muted",
        label: "!min-w-fit",
      }}
      key={`observation-${observation.id}`}
      itemId={`observation-${observation.id}`}
      label={
        <TreeItemInner
          latency={latency}
          type={observation.type}
          name={observation.name}
          startOffset={startOffset}
          firstTokenTimeOffset={firstTokenTimeOffset}
          totalScaleSpan={totalScaleSpan}
          setBackgroundColor={setBackgroundColor}
          level={level}
          cardWidth={cardWidth}
        >
          <>
            <h3 className="mb-6 px-8 pt-8 text-2xl font-semibold tracking-tight">
              Detail view
            </h3>
            <div className="overflow-y-auto px-8 pb-8 pt-2">
              <ObservationPreview
                observations={observations}
                scores={scores}
                projectId={projectId}
                currentObservationId={observation.id}
                traceId={observation.traceId}
                commentCounts={commentCounts}
              />
            </div>
          </>
        </TreeItemInner>
      }
    >
      {Array.isArray(observation.children)
        ? observation.children.map((child) => (
            <TraceTreeItem
              key={`observation-${child.id}`}
              observation={child}
              level={level + 1}
              traceStartTime={traceStartTime}
              totalScaleSpan={totalScaleSpan}
              projectId={projectId}
              scores={scores}
              observations={observations}
              cardWidth={cardWidth}
              commentCounts={commentCounts}
            />
          ))
        : null}
    </TreeItem>
  );
}

export function TraceTimelineView({
  trace,
  observations,
  projectId,
  scores,
}: {
  trace: Omit<Trace, "input" | "output"> & {
    latency?: number;
    input: string | undefined;
    output: string | undefined;
  };
  observations: Array<ObservationReturnType>;
  projectId: string;
  scores: APIScore[];
}) {
  const { latency, name, id } = trace;
  const [backgroundColor, setBackgroundColor] = useState("");
  const [expandedItems, setExpandedItems] = useSessionStorage<string[]>(
    `${id}-expanded`,
    [`trace-${id}`],
  );

  const [cardWidth, setCardWidth] = useState(0);
  const parentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleResize = () => {
      if (parentRef.current) {
        const availableWidth = parentRef.current.offsetWidth;
        setCardWidth(availableWidth);
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize); // Recalculate on window resize

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [parentRef]);

  const { nestedObservations } = useMemo(
    () => nestObservations(observations),
    [observations],
  );
  const nestedObservationKeys = useMemo(
    () => getNestedObservationKeys(nestedObservations),
    [nestedObservations],
  );

  const isAuthenticatedAndProjectMember =
    useIsAuthenticatedAndProjectMember(projectId);

  const observationCommentCounts = api.comments.getCountByObjectType.useQuery(
    {
      projectId: trace.projectId,
      objectType: "OBSERVATION",
    },
    {
      trpc: {
        context: {
          skipBatch: true,
        },
      },
      refetchOnMount: false, // prevents refetching loops
      enabled: isAuthenticatedAndProjectMember,
    },
  );

  const traceCommentCounts = api.comments.getCountByObjectId.useQuery(
    {
      projectId: trace.projectId,
      objectId: trace.id,
      objectType: "TRACE",
    },
    {
      trpc: {
        context: {
          skipBatch: true,
        },
      },
      refetchOnMount: false, // prevents refetching loops
      enabled: isAuthenticatedAndProjectMember,
    },
  );

  if (!latency) return null;

  const stepSize = calculateStepSize(latency, SCALE_WIDTH);
  const totalScaleSpan = stepSize * (SCALE_WIDTH / STEP_SIZE);

  return (
    <div ref={parentRef} className="h-full w-full">
      <Card
        className="flex max-h-full flex-col overflow-x-auto overflow-y-hidden"
        style={{ width: cardWidth }}
      >
        <div className="grid w-full grid-cols-[1fr,auto] items-center p-2">
          <div
            className="flex flex-row items-center gap-2"
            style={{
              minWidth: `${MIN_LABEL_WIDTH}px`,
            }}
          >
            <h3 className="text-xl font-semibold tracking-tight">
              Trace Timeline
            </h3>
            <div className="flex h-full items-center">
              <Button
                onClick={() =>
                  setExpandedItems([
                    `trace-${trace.id}`,
                    ...nestedObservationKeys,
                  ])
                }
                size="xs"
                variant="ghost"
                title="Expand all"
              >
                <PlusSquareIcon className="h-4 w-4" />
              </Button>
              <Button
                onClick={() => setExpandedItems([])}
                size="xs"
                variant="ghost"
                title="Collapse all"
              >
                <MinusSquare className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div
            className="relative mr-2 h-4"
            style={{ width: `${SCALE_WIDTH}px` }}
          >
            {Array.from({ length: SCALE_WIDTH / STEP_SIZE + 1 }).map(
              (_, index) => {
                const step = stepSize * index;
                const isLastStep = index === SCALE_WIDTH / STEP_SIZE;

                return isLastStep ? (
                  <span
                    className="absolute -right-2 text-xs text-muted-foreground"
                    key={index}
                  >
                    {step.toFixed(latency.toString().length >= 8 ? 0 : 2)}s
                  </span>
                ) : (
                  <div
                    key={index}
                    className="absolute h-full border border-l text-xs"
                    style={{ left: `${index * STEP_SIZE}px` }}
                  >
                    <span className="absolute left-2 text-xs text-muted-foreground">
                      {step.toFixed(2)}s
                    </span>
                  </div>
                );
              },
            )}
          </div>
        </div>
        <div className="min-w-fit overflow-y-auto p-2">
          <SimpleTreeView
            slots={{
              expandIcon: PlusIcon,
              collapseIcon: MinusIcon,
            }}
            expandedItems={expandedItems}
            onExpandedItemsChange={(_, itemIds) => setExpandedItems(itemIds)}
            itemChildrenIndentation={TREE_INDENTATION}
          >
            <TreeItem
              key={`trace-${id}`}
              itemId={`trace-${id}`}
              classes={{
                content: `${backgroundColor} !min-w-fit !hover:bg-muted`,
                selected: "!bg-background !important hover:!bg-muted",
                label: "!min-w-fit",
              }}
              label={
                <TreeItemInner
                  name={name}
                  latency={latency}
                  totalScaleSpan={totalScaleSpan}
                  setBackgroundColor={setBackgroundColor}
                  type="TRACE"
                  cardWidth={cardWidth}
                >
                  <div className="overflow-y-auto p-8">
                    <h3 className="mb-6 text-2xl font-semibold tracking-tight">
                      Detail view
                    </h3>
                    <TracePreview
                      trace={trace}
                      observations={observations}
                      scores={scores}
                      commentCounts={traceCommentCounts.data}
                    />
                  </div>
                </TreeItemInner>
              }
            >
              {Boolean(nestedObservations.length)
                ? nestedObservations.map((observation) => (
                    <TraceTreeItem
                      key={`observation-${observation.id}`}
                      observation={observation}
                      level={1}
                      traceStartTime={nestedObservations[0].startTime}
                      totalScaleSpan={totalScaleSpan}
                      projectId={projectId}
                      scores={scores}
                      observations={observations}
                      cardWidth={cardWidth}
                      commentCounts={observationCommentCounts.data}
                    />
                  ))
                : null}
            </TreeItem>
          </SimpleTreeView>
        </div>
      </Card>
    </div>
  );
}
