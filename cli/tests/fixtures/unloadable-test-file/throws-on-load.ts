export function refuseToLoad(): never {
  throw new Error("the module under test failed to load");
}

refuseToLoad();
