'use client'

import * as React from 'react'
import { Upload, X, FileIcon } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/button'

interface FileDropzoneProps {
  accept?: string
  maxSize?: number
  onDrop: (files: File[]) => void
  multiple?: boolean
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

export function FileDropzone({
  accept,
  maxSize,
  onDrop,
  multiple = false,
}: FileDropzoneProps) {
  const [isDragOver, setIsDragOver] = React.useState(false)
  const [files, setFiles] = React.useState<File[]>([])
  const [error, setError] = React.useState<string | null>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const validateFiles = (fileList: File[]): File[] => {
    setError(null)
    const validFiles: File[] = []

    for (const file of fileList) {
      if (accept) {
        const acceptedTypes = accept.split(',').map((t) => t.trim())
        const fileType = file.type
        const fileExt = '.' + file.name.split('.').pop()?.toLowerCase()
        const isAccepted = acceptedTypes.some(
          (type) =>
            type === fileType ||
            type === fileExt ||
            (type.endsWith('/*') && fileType.startsWith(type.replace('/*', '/')))
        )
        if (!isAccepted) {
          setError(`File type "${file.name}" is not accepted.`)
          continue
        }
      }

      if (maxSize && file.size > maxSize) {
        setError(`File "${file.name}" exceeds the maximum size of ${formatBytes(maxSize)}.`)
        continue
      }

      validFiles.push(file)
    }

    return validFiles
  }

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList) return
    const incoming = Array.from(fileList)
    const valid = validateFiles(incoming)
    if (valid.length === 0) return

    const newFiles = multiple ? [...files, ...valid] : valid.slice(0, 1)
    setFiles(newFiles)
    onDrop(newFiles)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleDropEvent = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    handleFiles(e.dataTransfer.files)
  }

  const removeFile = (index: number) => {
    const newFiles = files.filter((_, i) => i !== index)
    setFiles(newFiles)
    onDrop(newFiles)
  }

  return (
    <div className="space-y-3">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDropEvent}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors',
          isDragOver
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover:border-muted-foreground/50'
        )}
      >
        <Upload
          className={cn(
            'h-10 w-10 mb-3',
            isDragOver ? 'text-primary' : 'text-muted-foreground'
          )}
        />
        <p className="text-sm font-medium">
          {isDragOver ? 'Drop files here' : 'Click to upload or drag and drop'}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {accept && `Accepted: ${accept}`}
          {accept && maxSize && ' | '}
          {maxSize && `Max size: ${formatBytes(maxSize)}`}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
        />
      </div>

      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}

      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${index}`}
              className="flex items-center justify-between rounded-md border px-3 py-2"
            >
              <div className="flex items-center gap-2 min-w-0">
                <FileIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate text-sm">{file.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatBytes(file.size)}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={(e) => {
                  e.stopPropagation()
                  removeFile(index)
                }}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
