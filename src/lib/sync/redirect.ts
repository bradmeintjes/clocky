// Imported first in main.ts, so the OAuth fragment is consumed before the hash router starts.
import { consumeRedirect } from './auth'

export const redirectResult = consumeRedirect()
