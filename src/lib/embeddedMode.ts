export function isSub2ApiEmbeddedMode(
  searchParams = typeof window === 'undefined'
    ? new URLSearchParams()
    : new URLSearchParams(window.location.search),
) {
  return searchParams.get('ui_mode') === 'embedded'
}
