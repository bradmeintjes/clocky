import { parseHash, type Route } from './routes'

class Router {
  route = $state<Route>(parseHash(location.hash))

  constructor() {
    addEventListener('hashchange', () => {
      this.route = parseHash(location.hash)
    })
  }
}

export const router = new Router()
