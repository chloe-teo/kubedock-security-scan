import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { metrics } from '@opentelemetry/api';

let sdk: NodeSDK | undefined;

export function initTelemetry(): void {
    const endpoint = process.env['OTEL_EXPORTER_OTLP_ENDPOINT'];
    if (!endpoint) return;

    sdk = new NodeSDK({
        resource: resourceFromAttributes({
            [ATTR_SERVICE_NAME]: process.env['OTEL_SERVICE_NAME'] ?? 'kubedock-security-scan',
        }),
        metricReader: new PeriodicExportingMetricReader({
            exporter: new OTLPMetricExporter(),
            exportIntervalMillis: 10_000,
        }),
        instrumentations: [],
    });

    sdk.start();
    console.log(`OpenTelemetry initialised — endpoint: ${endpoint}`);
}

export function getMeter() {
    return metrics.getMeter('kubedock-security-scan');
}

export async function shutdownTelemetry(): Promise<void> {
    await sdk?.shutdown();
}
