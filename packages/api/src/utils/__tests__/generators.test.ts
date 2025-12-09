import fetch from 'node-fetch';
import { logger } from '@librechat/data-schemas';
import { createFetch } from '../generators';

jest.mock('node-fetch', () => jest.fn());
jest.mock(
  '@librechat/data-schemas',
  () => ({
    logger: {
      debug: jest.fn(),
      warn: jest.fn(),
    },
  }),
  { virtual: true },
);

describe('createFetch', () => {
  const mockedFetch = fetch as jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('merges request query params into the direct endpoint URL without overriding existing values', async () => {
    mockedFetch.mockResolvedValue({ ok: true } as any);

    const reverseProxyUrl =
      'https://proxy.example.com/responses?api-version=2025-11-15-preview';
    const requestUrl = 'https://ignored.example.com?foo=bar&api-version=override';

    const proxyFetch = createFetch({ directEndpoint: true, reverseProxyUrl });

    await proxyFetch(requestUrl, { method: 'POST' } as any);

    expect(mockedFetch).toHaveBeenCalledWith(
      'https://proxy.example.com/responses?api-version=2025-11-15-preview&foo=bar',
      { method: 'POST' },
    );
  });

  it('falls back to the provided reverse proxy URL when URL parsing fails', async () => {
    mockedFetch.mockResolvedValue({ ok: true } as any);

    const proxyFetch = createFetch({ directEndpoint: true, reverseProxyUrl: 'not-a-url' });

    await proxyFetch('notaurl', { method: 'GET' } as any);

    expect(logger.warn).toHaveBeenCalledTimes(1);
    const warnArgs = (logger.warn as jest.Mock).mock.calls[0];
    expect(warnArgs[0]).toBe('[createFetch] Failed to merge direct endpoint URL params');
    expect(warnArgs[1]).toEqual(expect.objectContaining({ message: 'Invalid URL' }));
    expect(mockedFetch).toHaveBeenCalledWith('not-a-url', { method: 'GET' });
  });
});
