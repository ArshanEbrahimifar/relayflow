import { context, trace } from '@opentelemetry/api';

export type TraceLogContext = {
  traceId?: string;
  spanId?: string;
};

export function getTraceLogContext(): TraceLogContext {
  const span = trace.getSpan(context.active());

  if (!span) {
    return {};
  }

  const spanContext = span.spanContext();

  return {
    traceId: spanContext.traceId,
    spanId: spanContext.spanId,
  };
}
