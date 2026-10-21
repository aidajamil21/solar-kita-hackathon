export function requireUser(req, res, next) {
  const userId = req.header('x-user-id')

  if (!userId) {
    return res.status(401).json({ error: 'Missing x-user-id header' })
  }

  req.userId = userId
  return next()
}
