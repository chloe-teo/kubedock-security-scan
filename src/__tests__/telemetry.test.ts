const mockStart = jest.fn();
const mockShutdown = jest.fn();

beforeEach(() => {
    jest.resetModules();
    mockStart.mockReset();
    mockShutdown.mockReset();
    mockShutdown.mockResolvedValue(undefined);
    delete process.env['OTEL_EXPORTER_OTLP_ENDPOINT'];
    delete process.env['OTEL_SERVICE_NAME'];

    jest.doMock('@opentelemetry/sdk-node', () => ({
        NodeSDK: jest.fn().mockImplementation(() => ({ start: mockStart, shutdown: mockShutdown })),
    }));
    jest.doMock('@opentelemetry/exporter-metrics-otlp-http', () => ({ OTLPMetricExporter: jest.fn() }));
    jest.doMock('@opentelemetry/sdk-metrics', () => ({ PeriodicExportingMetricReader: jest.fn() }));
    jest.doMock('@opentelemetry/resources', () => ({ resourceFromAttributes: jest.fn().mockReturnValue({}) }));
    jest.doMock('@opentelemetry/semantic-conventions', () => ({ ATTR_SERVICE_NAME: 'service.name' }));
    jest.doMock('@opentelemetry/api', () => ({ metrics: { getMeter: jest.fn().mockReturnValue({}) } }));
});

afterEach(() => {
    delete process.env['OTEL_EXPORTER_OTLP_ENDPOINT'];
    delete process.env['OTEL_SERVICE_NAME'];
});

describe('initTelemetry', () => {
    it('does not start SDK when OTEL_EXPORTER_OTLP_ENDPOINT is not set', () => {
        const { initTelemetry } = require('../telemetry');
        initTelemetry();
        expect(mockStart).not.toHaveBeenCalled();
    });

    it('starts SDK when OTEL_EXPORTER_OTLP_ENDPOINT is set', () => {
        process.env['OTEL_EXPORTER_OTLP_ENDPOINT'] = 'http://example.com/otlp';
        const { initTelemetry } = require('../telemetry');
        initTelemetry();
        expect(mockStart).toHaveBeenCalled();
    });

    it('uses kubedock-security-scan as default service name', () => {
        process.env['OTEL_EXPORTER_OTLP_ENDPOINT'] = 'http://example.com/otlp';
        const { resourceFromAttributes } = require('@opentelemetry/resources');
        const { initTelemetry } = require('../telemetry');
        initTelemetry();
        expect(resourceFromAttributes).toHaveBeenCalledWith(
            expect.objectContaining({ 'service.name': 'kubedock-security-scan' })
        );
    });

    it('uses OTEL_SERVICE_NAME when set', () => {
        process.env['OTEL_EXPORTER_OTLP_ENDPOINT'] = 'http://example.com/otlp';
        process.env['OTEL_SERVICE_NAME'] = 'my-custom-service';
        const { resourceFromAttributes } = require('@opentelemetry/resources');
        const { initTelemetry } = require('../telemetry');
        initTelemetry();
        expect(resourceFromAttributes).toHaveBeenCalledWith(
            expect.objectContaining({ 'service.name': 'my-custom-service' })
        );
    });

    it('logs the endpoint when SDK is initialised', () => {
        process.env['OTEL_EXPORTER_OTLP_ENDPOINT'] = 'http://example.com/otlp';
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
        const { initTelemetry } = require('../telemetry');
        initTelemetry();
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('http://example.com/otlp'));
        consoleSpy.mockRestore();
    });
});

describe('shutdownTelemetry', () => {
    it('resolves without error when SDK was never initialised', async () => {
        const { shutdownTelemetry } = require('../telemetry');
        await expect(shutdownTelemetry()).resolves.toBeUndefined();
        expect(mockShutdown).not.toHaveBeenCalled();
    });

    it('calls sdk.shutdown when SDK is initialised', async () => {
        process.env['OTEL_EXPORTER_OTLP_ENDPOINT'] = 'http://example.com/otlp';
        const { initTelemetry, shutdownTelemetry } = require('../telemetry');
        initTelemetry();
        await shutdownTelemetry();
        expect(mockShutdown).toHaveBeenCalled();
    });
});

describe('getMeter', () => {
    it('returns the meter from the OTel API using the library name', () => {
        const mockMeter = {};
        const mockGetMeter = jest.fn().mockReturnValue(mockMeter);
        jest.doMock('@opentelemetry/api', () => ({ metrics: { getMeter: mockGetMeter } }));
        const { getMeter } = require('../telemetry');
        const result = getMeter();
        expect(mockGetMeter).toHaveBeenCalledWith('kubedock-security-scan');
        expect(result).toBe(mockMeter);
    });
});
