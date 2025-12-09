const client = require('openid-client');
const { logger } = require('@librechat/data-schemas');
const { CacheKeys } = require('librechat-data-provider');
const { getOpenIdConfig } = require('~/strategies/openidStrategy');
const getLogStores = require('~/cache/getLogStores');

/**
 * Exchanges an OpenID access token for an Azure AI Foundry access token using the OBO flow.
 * @param {object} params
 * @param {import('@librechat/data-schemas').User} params.user - The authenticated user
 * @param {string} params.accessToken - The OpenID access token to exchange
 * @param {string} params.scope - The Azure AI Foundry scope (e.g. "https://ai.azure.com/.default")
 * @returns {Promise<string>} Azure AI Foundry access token
 */
async function getAzureFoundryToken({ user, accessToken, scope, fromCache = true }) {
  try {
    if (!user?.openidId) {
      throw new Error('User must be authenticated with OpenID to use Azure AI Foundry');
    }

    if (!accessToken) {
      throw new Error('Access token is required for Azure AI Foundry token exchange');
    }

    if (!scope) {
      throw new Error('Azure AI Foundry scope is required for token exchange');
    }

    const config = getOpenIdConfig();
    if (!config) {
      throw new Error('OpenID configuration not available');
    }

    const cacheKey = `${user.openidId}:${scope}:azure_foundry`;
    const tokensCache = getLogStores(CacheKeys.OPENID_EXCHANGED_TOKENS);
    if (fromCache) {
      const cachedToken = await tokensCache.get(cacheKey);
      if (cachedToken) {
        logger.debug(`[AzureFoundryTokenService] Using cached token for ${user.openidId}`);
        return cachedToken.access_token;
      }
    }

    logger.debug(`[AzureFoundryTokenService] Requesting Azure AI Foundry token for ${user.openidId}`);

    const grantResponse = await client.genericGrantRequest(
      config,
      'urn:ietf:params:oauth:grant-type:jwt-bearer',
      {
        scope,
        assertion: accessToken,
        requested_token_use: 'on_behalf_of',
      },
    );

    await tokensCache.set(
      cacheKey,
      { access_token: grantResponse.access_token },
      (grantResponse.expires_in || 3600) * 1000,
    );

    logger.debug(`[AzureFoundryTokenService] Cached Azure Foundry token for ${user.openidId}`);
    return grantResponse.access_token;
  } catch (error) {
    logger.error(
      `[AzureFoundryTokenService] Failed to acquire Azure AI Foundry token for ${user?.openidId}:`,
      error,
    );
    throw new Error(`Azure AI Foundry token acquisition failed: ${error.message}`);
  }
}

module.exports = { getAzureFoundryToken };
