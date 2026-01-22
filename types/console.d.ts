// Fix for environments where console is not globally typed as expected
export {}
declare global {
  // Only declare if not already present
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  var console: Console & { warn: (...args: any[]) => void; error: (...args: any[]) => void; log: (...args: any[]) => void }
}
