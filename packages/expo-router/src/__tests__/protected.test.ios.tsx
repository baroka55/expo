import React, { useState } from 'react';
import { Text } from 'react-native';

import { store } from '../global-state/router-store';
import { router } from '../imperative-api';
import Stack from '../layouts/Stack';
import { act, renderRouter, screen } from '../testing-library';

it('should work within the default Stack', () => {
  let update;
  let shouldShowA = false;

  renderRouter(
    {
      _layout: function Layout() {
        const state = useState(0);
        update = state[1];
        console.log('test rendered');
        return (
          <Stack id={undefined}>
            <Stack.Protected guard={shouldShowA}>
              <Stack.Screen name="a" />
            </Stack.Protected>

            <Stack.Screen name="b" />
          </Stack>
        );
      },
      index: () => {
        return <Text testID="index">index</Text>;
      },
      a: () => <Text testID="a">a</Text>,
      b: () => <Text testID="b">B</Text>,
      c: () => <Text testID="c">C</Text>,
    },
    { initialUrl: '/a' }
  );

  expect(store.rootStateSnapshot()).toStrictEqual({});

  // expect(store.rootStateSnapshot()).toStrictEqual({
  //   index: 0,
  //   key: expect.any(String),
  //   preloadedRoutes: [],
  //   routeNames: ['__root'],
  //   routes: [
  //     {
  //       key: expect.any(String),
  //       name: '__root',
  //       params: undefined,
  //       state: {
  //         index: 0,
  //         key: expect.any(String),
  //         preloadedRoutes: [],
  //         routeNames: ['a', 'b', 'c', '_sitemap', '+not-found'],
  //         routes: [
  //           {
  //             key: expect.any(String),
  //             name: 'b',
  //             params: undefined,
  //           },
  //         ],
  //         stale: false,
  //         type: 'stack',
  //       },
  //     },
  //   ],
  //   stale: false,
  //   type: 'stack',
  // });

  expect(screen.getByTestId('b')).toBeVisible();

  console.log('----');
  shouldShowA = true;
  act(() => {
    update(1);
  });

  act(() => router.replace('/a'));
  expect(screen.getByTestId('a')).toBeVisible();
  expect(store.rootStateSnapshot()).toStrictEqual({});
});
