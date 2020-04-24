import React from 'react';
import {useState, useRef, useEffect, useMemo, useCallback} from 'react';
import {fabric} from 'fabric';
import {emitMessage, broadcastMessage, onMessageReceived} from 'partygam.es-client-api/src';

interface CanvasProps {
    drawColor?: string;
    isInteractive: boolean;
    width: number;
}

enum StrokeSize {
    SIZE_SMALL = 3,
    SIZE_NORMAL = 7,
    SIZE_LARGE = 10 ,
    SIZE_XLARGE= 15,
}

export interface SvgPath {
    svgString: string;
    strokeWidth: number;
    strokeColor?: string;
}

export interface PreviewSvgPath {
    strokeColor: string;
    strokeWidth: number;
    points: ReadonlyArray<{x: number, y: number}>
}

const CANVAS_MAX_WIDTH = 1000;
const CANVAS_RATIO = 0.6;

export const Canvas: React.FC<CanvasProps> = (
    { width, isInteractive = true, drawColor = '#ff0000' }
) => {

    const canvasRef = useRef(null);
    const [fabricCanvas, setFabricCanvas] = useState<fabric.Canvas>(null);
    const [drawPoints, setDrawPoints] = useState<ReadonlyArray<SvgPath>>([]);
    const [previewPoints, setPreviewPoints] = useState<PreviewSvgPath>({
        strokeColor: drawColor,
        strokeWidth: StrokeSize.SIZE_NORMAL,
        points: []
    });
    const prevDrawPointsLength = useRef(0);
    const prevPreviewPointsLength = useRef(0);
    const strokeSize = useRef<StrokeSize>(StrokeSize.SIZE_NORMAL);

    const [actualWidth, actualHeight] = useMemo<[number, number]>(() => {
        return [Math.min(CANVAS_MAX_WIDTH, width), Math.min(CANVAS_MAX_WIDTH * CANVAS_RATIO, width * CANVAS_RATIO)];
    }, [width]);

    const scale = useMemo<number>(() => {
        return actualWidth / CANVAS_MAX_WIDTH;
    }, [actualWidth]);

    console.log({ scale, width, actualWidth, actualHeight});

    const strokeSettings = {
        stroke: drawColor,
        strokeLineCap: "round",
        strokeMiterLimit: 10,
        strokeLineJoin: "round",
        hoverCursor: "default",
        selectable: false,
        interactive: false,
    };

    const lineDiffMargin = 2;
    const previewIntervalMs = 500;

    const resetCanvas = useCallback(() => {

        prevDrawPointsLength.current = 0;
        prevPreviewPointsLength.current = 0;

        setFabricCanvas(state => {
            if (! state) return state;
            state.clear();
            state.backgroundColor = '#FFFFFF';
            return state;
        });

    }, [fabricCanvas]);

    useEffect(() => {

        if (null === fabricCanvas) {
            return;
        }

        if (previewPoints.points.length > 0) {

            const brush = new fabric.PencilBrush();

            const points: fabric.Point[] = [];
            previewPoints.points.forEach((point) => {
                points.push(new fabric.Point(point.x, point.y));
            });

            const startIndex = prevPreviewPointsLength.current;
            const timePerCall = previewIntervalMs / (points.length - startIndex);
            let index = startIndex + 2;
            let i = null;
            let lastPath = null;
            let path;
            i = setInterval(() => {

                path = brush.createPath(brush.convertPointsToSVGPath(points.slice(startIndex, index)).toString());
                path.set({
                    left: path.left * scale,
                    top: path.top * scale,
                    ...strokeSettings,
                    stroke: previewPoints.strokeColor,
                    strokeWidth: previewPoints.strokeWidth / scale,
                    scaleX: scale,
                    scaleY: scale,
                });

                if (lastPath) {
                    fabricCanvas.remove(lastPath);
                    lastPath = path;
                }
                fabricCanvas.add(path);

                index++;

                if (index === previewPoints.points.length) {
                    clearInterval(i);
                }

            }, timePerCall);

            prevPreviewPointsLength.current = previewPoints.points.length;

            return () => {
                fabricCanvas.remove(path);
                if (i) {
                    clearInterval(i);
                }
                path = brush.createPath(brush.convertPointsToSVGPath(points).toString());
                path.set({
                    left: path.left * scale,
                    top: path.top * scale,
                    ...strokeSettings,
                    stroke: previewPoints.strokeColor,
                    strokeWidth: previewPoints.strokeWidth / scale,
                    scaleX: scale,
                    scaleY: scale,
                });
                fabricCanvas.add(path);
            };

        }
        else {
            prevPreviewPointsLength.current = 0;
        }

    }, [fabricCanvas, previewPoints, prevPreviewPointsLength.current]);

    useEffect(() => {

        if (null === fabricCanvas || drawPoints.length === 0) {
            return;
        }

        const brush = new fabric.PencilBrush();

        const lines = [];

        console.log(prevDrawPointsLength.current, drawPoints, drawPoints.slice(prevDrawPointsLength.current));

        drawPoints.slice(prevDrawPointsLength.current).forEach(({ svgString, strokeWidth, strokeColor }) => {
            // Create the Path
            const path = brush.createPath(svgString);
            path.set({
                left: path.left * scale,
                top: path.top * scale,
                ...strokeSettings,
                stroke: strokeColor,
                strokeWidth: strokeWidth / scale,
                scaleX: scale,
                scaleY: scale,
            });
            lines.push(path);
        });

        prevDrawPointsLength.current = drawPoints.length;

        const group = new fabric.Group(lines, {
            selectable: false,
            hoverCursor: 'default',
        });

        fabricCanvas.add(group);

    }, [drawPoints, prevDrawPointsLength.current]);

    useEffect(() => {

        // scale changed, redraw canvas
        resetCanvas();

        // trigger a redraw after resetting canvas
        setDrawPoints(state => state.concat([]));

    }, [scale]);

    // TODO: update canvas size, interactivity etc when props change
    useEffect(() => {

        if (!fabricCanvas) {
            return;
        }

        fabricCanvas.interactive = isInteractive;

        fabricCanvas.setWidth(actualWidth);
        fabricCanvas.setHeight( actualHeight);
        fabricCanvas.calcOffset();

        // fabricCanvas.centeredScaling = true;
        // fabricCanvas.setZoom(actualWidth / CANVAS_MAX_WIDTH);

    }, [fabricCanvas, isInteractive, actualWidth]);

    useEffect(() => {

        if (null === canvasRef.current) {
            return;
        }

        let canvas = fabricCanvas;
        if (null === fabricCanvas) {
            const $canvas = canvasRef.current;

            canvas = new fabric.Canvas($canvas, {
                selection: false,
                interactive: isInteractive,
                backgroundColor: '#FFFFFF',
                imageSmoothingEnabled: false,
            });
        }

        const brush = new fabric.PencilBrush();

        let mouseIsDown = false;
        let mouseDownInterval = null;

        let currentDrawPoints: ReadonlyArray<fabric.Point> = [];
        let currentDrawLines: ReadonlyArray<fabric.Line> = [];

        const onCanvasMouseMove = (event) => {

            const point = new fabric.Point(event.pointer.x - (strokeSize.current / 2), event.pointer.y - (strokeSize.current / 2));

            if (currentDrawPoints.length > 1) {

                const prevPoint = currentDrawPoints[currentDrawPoints.length - 1];

                // TOOD: check if x or y has moved enough
                if (Math.abs(prevPoint.x - point.x) < lineDiffMargin && Math.abs(prevPoint.y - point.y) < lineDiffMargin) {
                    console.log('DIFFERENCE IS TOO SMALL!');
                    return;
                }

                currentDrawPoints = currentDrawPoints.concat(
                    point
                );

                const line = new fabric.Line([prevPoint.x, prevPoint.y, point.x, point.y], {
                    hasControls: true,
                    hasBorders: false,
                    hoverCursor: 'default',
                    ...strokeSettings,
                    strokeWidth: strokeSize.current,
                });

                currentDrawLines = currentDrawLines.concat(line);
                canvas.add(line);

            } else {

                currentDrawPoints = currentDrawPoints.concat(
                    point
                );

            }

        };

        canvas.on('mouse:down', (event) => {

            if (!isInteractive) {
                return;
            }

            currentDrawPoints = [];
            currentDrawLines = [];
            mouseIsDown = true;
            canvas.on('mouse:move', onCanvasMouseMove);

            mouseDownInterval = setInterval(() => {
                const translateTo = CANVAS_MAX_WIDTH / actualWidth;
                const translatedDrawPoints: { x: number; y: number }[] =
                    currentDrawPoints.map((point) =>
                        (new fabric.Point(point.x * translateTo,point.y * translateTo))
                    );
                emitMessage({
                    type: 'preview',
                    path: {
                        points: translatedDrawPoints,
                        strokeColor: drawColor,
                        strokeWidth: strokeSize.current,
                    },
                });
            }, previewIntervalMs);
        });

        canvas.on('mouse:up', (event) => {

            if (!isInteractive) {
                return;
            }

            if (null !== mouseDownInterval) {
                clearInterval(mouseDownInterval);
                mouseDownInterval = null;
            }
            mouseIsDown = false;
            canvas.off('mouse:move', onCanvasMouseMove);

            currentDrawLines.forEach((line) => {
                canvas.remove(line);
            });

            setDrawPoints((state: readonly SvgPath[]) => {
                // todo: translate current points for scale...

                let svgPathString;
                const translateTo = CANVAS_MAX_WIDTH / actualWidth;
                const drawPointsCopy = currentDrawPoints.concat([]);
                // remove the first point, this is automatically added by convertPointsToSVGPath
                drawPointsCopy.shift();
                if (drawPointsCopy.length > 1) {

                    const translatedDrawPoints: { x: number; y: number }[] =
                        drawPointsCopy.map((point) =>
                            (new fabric.Point(point.x * translateTo,point.y * translateTo))
                        );
                    svgPathString = brush.convertPointsToSVGPath(translatedDrawPoints).toString();

                }
                else {

                    const point = new fabric.Point(event.absolutePointer.x  * translateTo, event.absolutePointer.y  * translateTo);
                    svgPathString = brush.convertPointsToSVGPath([
                        point.clone().setXY(point.x - 1, point.y),
                        point.clone().setXY(point.x, point.y + 1),

                    ]).toString();

                }

                // console.log(svgPathString.length);
                // === not minimized! for some reason. Maybe try in the future
                // console.log(normalizeSvgPath(absSvgPath(parseSvgPath(svgPathString))).toString().length);

                state = state.concat({
                    svgString: svgPathString,
                    strokeColor: drawColor,
                    strokeWidth: strokeSize.current,
                });

                emitMessage({
                    type: 'draw',
                    points: {
                        svgString: svgPathString,
                        strokeColor: drawColor,
                        strokeWidth: strokeSize.current
                    },
                });
                return state;
            });
        });

        if (null === fabricCanvas) {
            setFabricCanvas(canvas);
        }

        return () => {
            canvas.off('mouse:move');
            canvas.off('mouse:down');
            canvas.off('mouse:up');
            if (null !== mouseDownInterval) {
                clearInterval(mouseDownInterval);
            }
        };

    }, [canvasRef.current, strokeSize.current, scale, isInteractive]);

    useEffect(() => {

        onMessageReceived((playerId, message) => {
            // setDrawPoints()
            if ('draw' === message.type || 'draw_replace_state' === message.type) {
                if ('draw_replace_state' === message.type) {
                    prevDrawPointsLength.current = 0;
                    resetCanvas();
                }
                setDrawPoints(state => 'draw_replace_state' === message.type ? message.points : state.concat(message.points));
                setPreviewPoints({
                    strokeColor: '#FFFFFF',
                    strokeWidth: 5,
                    points: [],
                });
            }
            else if ('preview' === message.type) {
                setPreviewPoints({
                    strokeColor: message.path.strokeColor,
                    strokeWidth: message.path.strokeWidth,
                    points: message.path.points,
                });
            }
        });

    }, []);

    const onUndo = () => {
        if (drawPoints.length > 0) {
            setDrawPoints(
                state => {
                    state = state.slice(0, -1);
                    broadcastMessage({
                        type: 'draw_replace_state',
                        points: state,
                    });
                    return state;
                }
            );
        }
    };

    const onClear = () => {
        if (drawPoints.length > 0) {
            setDrawPoints([]);
            broadcastMessage({
                type: 'draw_replace_state',
                points: [],
            });
        }
    };

    const setStrokeSize = (size: StrokeSize) => {
        strokeSize.current = size;
    };

    return <div>
        <canvas key="canvas" id="canvas" ref={canvasRef} width={actualWidth} height={actualHeight} />
        <div>
            <button className="btn is-secondary" type="button" onClick={onUndo}>Undo</button>
            <button className="btn is-secondary" type="button" onClick={onClear}>Clear</button>
            <button className="btn" type="button" style={{ fontSize: `${StrokeSize.SIZE_SMALL*2}px`, height: '60px', width: '60px' }} onClick={e => setStrokeSize(StrokeSize.SIZE_SMALL)}>
                &#x25CF;
            </button>
            <button className="btn" type="button" style={{ fontSize: `${StrokeSize.SIZE_NORMAL*2}px`, height: '60px', width: '60px' }} onClick={e => setStrokeSize(StrokeSize.SIZE_NORMAL)}>
                &#x25CF;
            </button>
            <button className="btn" type="button" style={{ fontSize: `${StrokeSize.SIZE_LARGE*2}px`, height: '60px', width: '60px' }} onClick={e => setStrokeSize(StrokeSize.SIZE_LARGE)}>
                &#x25CF;
            </button>
            <button className="btn" type="button" style={{ fontSize: `${StrokeSize.SIZE_XLARGE*2}px`, height: '60px', width: '60px' }} onClick={e => setStrokeSize(StrokeSize.SIZE_XLARGE)}>
                &#x25CF;
            </button>
        </div>
    </div>;

};
