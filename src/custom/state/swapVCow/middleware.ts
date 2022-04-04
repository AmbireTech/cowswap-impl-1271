import { isAnyOf, Middleware } from '@reduxjs/toolkit'
import { AppState } from 'state'
import { finalizeTransaction } from '../enhancedTransactions/actions'
import { setStatus, SwapVCowStatus } from './actions'
import { getCowSoundSuccess } from 'utils/sound'

const isFinalizeTransaction = isAnyOf(finalizeTransaction)

// Watch for swapVCow tx being finalized and triggers a change of status
export const swapVCowMiddleware: Middleware<Record<string, unknown>, AppState> = (store) => (next) => (action) => {
  const result = next(action)

  let cowSound

  if (isFinalizeTransaction(action)) {
    const { chainId, hash } = action.payload
    const transaction = store.getState().transactions[chainId][hash]

    if (transaction.swapVCow) {
      const status = transaction.receipt?.status

      console.debug(
        `[stat:swapVCow:middleware] Convert vCOW to COW transaction finalized with status ${status}`,
        transaction.hash
      )

      store.dispatch(setStatus(SwapVCowStatus.INITIAL))
      cowSound = getCowSoundSuccess()
    }
  }

  if (cowSound) {
    cowSound.play().catch((e) => {
      console.error('🐮 [middleware::swapVCow] Moooooo cannot be played', e)
    })
  }

  return result
}
