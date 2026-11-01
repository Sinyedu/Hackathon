# Design review (step 2)

The Impeccable commands (`critique`, `polish`, `audit`) were not run; this is a manual review of the same concerns, checked in the dev state gallery.

| Finding                                                             | Status                                                                                    |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Gallery crashed: `useEffect` returned the value of `scrollIntoView` | Fixed (block body)                                                                        |
| Text contrast below 4.5:1                                           | None found; tested in both themes (`tokens.test.ts`)                                      |
| Hard-coded colors outside tokens                                    | None; enforced by test                                                                    |
| Status conveyed by color only                                       | Chips carry symbol + word; mascot states carry marks                                      |
| Reduced motion                                                      | `.kiwi--reduced` and the media query stop loops/hops; poses remain                        |
| Keyboard and focus                                                  | Native buttons/inputs, visible focus ring, `Esc` closes the panel                         |
| Not verified                                                        | Screen-reader pass, dark mode on a real device, 96 px silhouette check by a second person |
