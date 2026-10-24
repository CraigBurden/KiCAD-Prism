import { useLayoutEffect, useRef } from "react";

/** A ref to the latest `value`, for listeners and timers that outlive the render they were made in. */
export function useLatest<T>(value: T) {
    const ref = useRef(value);
    useLayoutEffect(() => {
        ref.current = value;
    });
    return ref;
}
