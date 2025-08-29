import path from 'path'
import fs from 'fs'

export const setupImageRoutes = (router, services) => {
  // Serve image content
  router.get('/images/:id/:type', (req, res) => {
    const { id, type } = req.params
    
    let imagePath
    
    switch (type) {
      case 'original':
        imagePath = path.join(process.cwd(), 'storage', 'originals', id.substring(0, 2), id)
        break
      case 'preproc':
        imagePath = path.join(process.cwd(), 'storage', 'preproc', id.substring(0, 2), id + '.webp')
        break
      case 'thumb':
        imagePath = path.join(process.cwd(), 'storage', 'thumbs', id.substring(0, 2), id + '.webp')
        break
      default:
        res.status(400).json({ error: 'Invalid image type' })
        return
    }
    
    if (!fs.existsSync(imagePath)) {
      res.status(404).json({ error: 'Image not found' })
      return
    }
    
    res.sendFile(path.resolve(imagePath))
  })
}