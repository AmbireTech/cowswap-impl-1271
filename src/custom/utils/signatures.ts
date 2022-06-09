import {
  domain as domainGp,
  signOrder as signOrderGp,
  signOrderCancellation as signOrderCancellationGp,
  OffChainSignature,
  Order,
  OrderCancellation as OrderCancellationGp,
  Signature,
  TypedDataVersionedSigner,
  IntChainIdTypedDataV4Signer,
  SigningScheme,
} from '@cowprotocol/contracts'

import { SupportedChainId as ChainId } from 'constants/chains'
import { GP_SETTLEMENT_CONTRACT_ADDRESS } from 'constants/index'
import { TypedDataDomain, Signer } from '@ethersproject/abstract-signer'
import { registerOnWindow } from 'utils/misc'
import { METHOD_NOT_FOUND_ERROR } from '@src/constants/misc'

// For error codes, see:
// - https://eth.wiki/json-rpc/json-rpc-error-codes-improvement-proposal
// - https://www.jsonrpc.org/specification#error_object
const METAMASK_SIGNATURE_ERROR_CODE = -32603
const METHOD_NOT_FOUND_ERROR_CODE = -32601
// Added the following because of 1Inch walet who doesn't send the error code
// So we will check the actual error text
const METHOD_NOT_FOUND_ERROR_MSG_REGEX = /Method not found/i
const V4_ERROR_MSG_REGEX = /eth_signTypedData_v4 does not exist/i
const V3_ERROR_MSG_REGEX = /eth_signTypedData_v3 does not exist/i
const RPC_REQUEST_FAILED_REGEX = /RPC request failed/i
const METAMASK_STRING_CHAINID_REGEX = /provided chainid .* must match the active chainid/i

export type UnsignedOrder = Omit<Order, 'receiver'> & { receiver: string }

export interface SignOrderParams {
  chainId: ChainId
  signer: Signer
  order: UnsignedOrder
  signingScheme: SigningScheme
}

// posted to /api/v1/orders on Order creation
// serializable, so no BigNumbers
//  See https://protocol-rinkeby.dev.gnosisdev.com/api/
export interface OrderCreation extends UnsignedOrder {
  signingScheme: SigningScheme // signed method

  // Signature is used for:
  //  - Signature: EIP-712,ETHSIGN
  //  - Owner address: for PRESIGN
  signature: string // 65 bytes encoded as hex without `0x` prefix. r + s + v from the spec
}

export interface SingOrderCancellationParams {
  chainId: ChainId
  signer: Signer
  orderId: string
  signingScheme: SigningScheme
}

export interface OrderCancellation extends OrderCancellationGp {
  signature: string
  signingScheme: SigningScheme
}

export type SigningSchemeValue = 'eip712' | 'ethsign' | 'eip1271' | 'presign'

interface SchemaInfo {
  libraryValue: number
  apiValue: SigningSchemeValue
}
const mapSigningSchema: Map<SigningScheme, SchemaInfo> = new Map([
  [SigningScheme.EIP712, { libraryValue: 0, apiValue: 'eip712' }],
  [SigningScheme.ETHSIGN, { libraryValue: 1, apiValue: 'ethsign' }],
  [SigningScheme.EIP1271, { libraryValue: 2, apiValue: 'eip1271' }],
  [SigningScheme.PRESIGN, { libraryValue: 3, apiValue: 'presign' }],
])

function _getSigningSchemeInfo(offChainSigningScheme: SigningScheme): SchemaInfo {
  debugger
  const value = mapSigningSchema.get(offChainSigningScheme)
  if (value === undefined) {
    throw new Error('Unknown schema ' + offChainSigningScheme)
  }

  return value
}

export function getSigningSchemeApiValue(ecdaSigningScheme: SigningScheme): string {
  return _getSigningSchemeInfo(ecdaSigningScheme).apiValue
}

export function getSigningSchemeLibValue(offChainSigningScheme: SigningScheme): number {
  return _getSigningSchemeInfo(offChainSigningScheme).libraryValue
}
// ---------------- end of the TODO:

function _getDomain(chainId: ChainId): TypedDataDomain {
  // Get settlement contract address
  const settlementContract = GP_SETTLEMENT_CONTRACT_ADDRESS[chainId]

  if (!settlementContract) {
    throw new Error('Unsupported network. Settlement contract is not deployed')
  }

  return domainGp(chainId, settlementContract) // TODO: Fix types in NPM package
}

async function _signOrder(params: SignOrderParams): Promise<Signature> {
  const { chainId, signer, order, signingScheme } = params

  const domain = _getDomain(chainId)
  console.log('[utils:signature] signOrder', {
    domain,
    order,
    signer,
  })

  return signOrderGp(domain, order, signer, getSigningSchemeLibValue(signingScheme))
}

async function _signOrderCancellation(params: SingOrderCancellationParams): Promise<Signature> {
  const { chainId, signer, signingScheme, orderId } = params

  const domain = _getDomain(chainId)

  console.log('[utils:signature] signOrderCancellation', {
    domain,
    orderId,
    signer,
  })

  return signOrderCancellationGp(domain, orderId, signer, getSigningSchemeLibValue(signingScheme))
}

type SigningResult = { signature: string; signingScheme: SigningScheme }

async function _signPayload(
  payload: any,
  signFn: typeof _signOrder | typeof _signOrderCancellation,
  signer: Signer,
  signingMethod: 'default' | 'v4' | 'int_v4' | 'v3' | 'eth_sign' = 'v4',
  isSmartContract: boolean
): Promise<SigningResult> {
  let signingScheme: SigningScheme
  if (isSmartContract) {
    if (signingMethod === 'eth_sign') {
      throw Error(METHOD_NOT_FOUND_ERROR)
    }
    signingScheme = SigningScheme.EIP1271
  } else {
    signingScheme = signingMethod === 'eth_sign' ? SigningScheme.ETHSIGN : SigningScheme.EIP712
  }

  let signature: Signature | null = null

  let _signer
  try {
    switch (signingMethod) {
      case 'default':
        _signer = new TypedDataVersionedSigner(signer)
        break
      case 'v3':
        _signer = new TypedDataVersionedSigner(signer, 'v3')
        break
      case 'int_v4':
        _signer = new IntChainIdTypedDataV4Signer(signer)
        break
      default:
        _signer = signer
    }
  } catch (e) {
    console.error('Wallet not supported:', e)
    throw new Error('Wallet not supported')
  }

  try {
    signature = (await signFn({ ...payload, signer: _signer, signingScheme })) as OffChainSignature
  } catch (e) {
    const regexErrorCheck = [METHOD_NOT_FOUND_ERROR_MSG_REGEX, RPC_REQUEST_FAILED_REGEX].some((regex) =>
      // for example 1Inch error doesn't have e.message so we will check the output of toString()
      [e.message, e.toString()].some((msg) => regex.test(msg))
    )

    if (e.code === METHOD_NOT_FOUND_ERROR_CODE || regexErrorCheck) {
      // Maybe the wallet returns the proper error code? We can only hope 🤞
      // OR it failed with a generic message, there's no error code set, and we also hope it'll work
      // with other methods...
      switch (signingMethod) {
        case 'v4':
          return _signPayload(payload, signFn, signer, 'default', isSmartContract)
        case 'default':
          return _signPayload(payload, signFn, signer, 'v3', isSmartContract)
        case 'v3':
          return _signPayload(payload, signFn, signer, 'eth_sign', isSmartContract)
        default:
          throw e
      }
    } else if (METAMASK_STRING_CHAINID_REGEX.test(e.message)) {
      // Metamask now enforces chainId to be an integer
      return _signPayload(payload, signFn, signer, 'int_v4', isSmartContract)
    } else if (e.code === METAMASK_SIGNATURE_ERROR_CODE) {
      // We tried to sign order the nice way.
      // That works fine for regular MM addresses. Does not work for Hardware wallets, though.
      // See https://github.com/MetaMask/metamask-extension/issues/10240#issuecomment-810552020
      // So, when that specific error occurs, we know this is a problem with MM + HW.
      // Then, we fallback to ETHSIGN.
      return _signPayload(payload, signFn, signer, 'eth_sign', isSmartContract)
    } else if (V4_ERROR_MSG_REGEX.test(e.message)) {
      // Failed with `v4`, and the wallet does not set the proper error code
      return _signPayload(payload, signFn, signer, 'v3', isSmartContract)
    } else if (V3_ERROR_MSG_REGEX.test(e.message)) {
      // Failed with `v3`, and the wallet does not set the proper error code
      return _signPayload(payload, signFn, signer, 'eth_sign', isSmartContract)
    } else {
      // Some other error signing. Let it bubble up.
      console.error(e)
      throw e
    }
  }
  return { signature: signature.data.toString(), signingScheme }
}

export async function signOrder(
  order: UnsignedOrder,
  chainId: ChainId,
  signer: Signer,
  isSmartContract: boolean
): Promise<SigningResult> {
  return _signPayload({ order, chainId }, _signOrder, signer, 'v4', isSmartContract)
}

export async function signOrderCancellation(
  orderId: string,
  chainId: ChainId,
  signer: Signer,
  isSmartContract: boolean
): Promise<SigningResult> {
  return _signPayload({ orderId, chainId }, _signOrderCancellation, signer, 'v4', isSmartContract)
}

registerOnWindow({ signature: { signOrder: _signOrder, getDomain: _getDomain } })
