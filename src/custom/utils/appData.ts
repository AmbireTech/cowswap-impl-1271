import { COW_SDK } from 'constants/index'
import {
  EnvironmentMetadata,
  MetadataDoc,
  QuoteMetadata,
  ReferralMetadata,
  SupportedChainId,
} from '@cowprotocol/cow-sdk'
import { environmentName } from 'utils/environments'

const QUOTE_METADATA_VERSION = '0.1.0'
const REFERRER_METADATA_VERSION = '0.1.0'
const ENVIRONMENT_METADATA_VERSION = '0.1.0'

export async function buildAppData(
  chainId: SupportedChainId,
  sellAmount: string,
  buyAmount: string,
  referrerAccount: string | undefined,
  appCode: string
) {
  const sdk = COW_SDK[chainId]

  // build quote metadata, not required in the schema but always present
  const quoteMetadata = _buildQuoteMetadata(sellAmount, buyAmount)
  const metadata: MetadataDoc = { quote: quoteMetadata }

  // build referrer metadata, optional
  if (referrerAccount) {
    metadata.referrer = _buildReferralMetadata(referrerAccount)
  }

  // build environment metadata, optional but very likely to be present
  const environmentMetadata = _buildEnvironmentMetadata()
  if (environmentMetadata) {
    metadata.environment = environmentMetadata
  }

  const doc = sdk.metadataApi.generateAppDataDoc(metadata, appCode)
  const calculatedAppData = await sdk.metadataApi.calculateAppDataHash(doc)

  return { doc, calculatedAppData }
}

function _buildQuoteMetadata(sellAmount: string, buyAmount: string): QuoteMetadata {
  return {
    // id: quoteId, TODO: add quoteId here when available
    sellAmount,
    buyAmount,
    version: QUOTE_METADATA_VERSION,
  }
}

function _buildReferralMetadata(address: string): ReferralMetadata {
  return {
    address,
    version: REFERRER_METADATA_VERSION,
  }
}

function _buildEnvironmentMetadata(): EnvironmentMetadata | undefined {
  const name = environmentName

  if (!name) {
    return
  }

  return {
    name,
    version: ENVIRONMENT_METADATA_VERSION,
  }
}
