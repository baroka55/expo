import { INTERNAL_SLOT_NAME, NOT_FOUND_NAME } from './constants';
import type { FocusedRouteState } from './global-state/router-store';

export type UrlObject = {
  unstable_globalHref: string;
  pathname: string;
  readonly params: Record<string, string | string[]>;
  segments: string[];
};

export const defaultRouteInfo: UrlObject = {
  unstable_globalHref: '',
  pathname: '/',
  params: {},
  segments: [],
};

export function getRouteInfoFromFocusedState(focusedState: FocusedRouteState): UrlObject {
  let state: FocusedRouteState | undefined = focusedState;

  let route: FocusedRouteState['routes'][number] = state.routes[0];
  if (route.name !== INTERNAL_SLOT_NAME) {
    throw new Error(`Expected the first route to be ${INTERNAL_SLOT_NAME}, but got ${route.name}`);
  }

  state = route.state;

  const segments: string[] = [];
  const params: UrlObject['params'] = Object.create(null);

  while (state) {
    route = state.routes[0];

    Object.assign(params, route.params);

    let routeName = route.name;
    if (routeName.startsWith('/')) {
      routeName = routeName.slice(1);
    }

    segments.push(...routeName.split('/'));
    state = route.state;
  }

  /**
   * If React Navigation didn't render the entire tree (e.g it was interrupted in a layout)
   * Then the reset of the focus state is still within the params
   */
  let lastRouteParams = route.params;
  while (lastRouteParams && 'screen' in lastRouteParams) {
    if (typeof lastRouteParams.screen === 'string') {
      segments.push(lastRouteParams.screen);
    }
    lastRouteParams = lastRouteParams.params;
  }

  if (typeof route.params?.screen === 'string') {
    segments.push(route.params.screen);
  }

  if (segments[segments.length - 1] === 'index') {
    segments.pop();
  }

  delete params['screen'];
  delete params['params'];

  const pathname =
    '/' +
    segments
      .filter((segment) => {
        return !(segment.startsWith('(') && segment.endsWith(')'));
      })
      .flatMap((segment) => {
        if (segment === NOT_FOUND_NAME) {
          const notFoundPath = params['not-found'];
          if (typeof notFoundPath === 'undefined') {
            // Not founds are optional, do nothing if its not present
            return [];
          } else if (Array.isArray(notFoundPath)) {
            return notFoundPath;
          } else {
            return [notFoundPath];
          }
        } else if (segment.startsWith('[...') && segment.endsWith(']')) {
          let paramName = segment.slice(4, -1);

          // Legacy for React Navigation optional params
          if (paramName.endsWith('?')) {
            paramName = paramName.slice(0, -1);
          }

          const values = params[paramName];

          // Catchall params are optional
          return values || [];
        } else if (segment.startsWith('[') && segment.endsWith(']')) {
          const paramName = segment.slice(1, -1);
          const value = params[paramName];

          // Optional params are optional
          return value ? [value] : [];
        } else {
          return [segment];
        }
      })
      .join('/');

  return {
    segments,
    pathname,
    params,
    unstable_globalHref: '',
  };
}
