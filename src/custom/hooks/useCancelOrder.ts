import { useCallback } from 'react'
import { sendOrderCancellation } from 'utils/trade'
import { useActiveWeb3React } from 'hooks/web3'
import { useRequestOrderCancellation } from 'state/orders/hooks'
import { useWalletInfo } from 'hooks/useWalletInfo'

export const useCancelOrder = () => {
  const { account, chainId, library } = useActiveWeb3React()
  const { isSmartContractWallet } = useWalletInfo()
  const cancelPendingOrder = useRequestOrderCancellation()
  return useCallback(
    async (orderId: string): Promise<void> => {
      if (!account || !chainId || !library) {
        return
      }
      const signer = library.getSigner()
      return sendOrderCancellation({ chainId, orderId, signer, account, cancelPendingOrder, isSmartContractWallet })
    },
    [account, cancelPendingOrder, chainId, isSmartContractWallet, library]
  )
}
