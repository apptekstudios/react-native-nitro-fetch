package com.margelo.nitro.nitrofetch

import android.net.Uri
import com.margelo.nitro.NitroModules
import java.io.ByteArrayOutputStream
import java.io.File
import java.util.UUID

object MultipartBodyBuilder {
  /// Builds an RFC 2046 multipart/form-data body and returns `(body, contentType)`.
  /// File URIs are read synchronously. `http(s)://` source URIs block the calling thread.
  fun build(parts: Array<NitroFormDataPart>): Pair<ByteArray, String> {
    val boundary = "NitroFetch-${UUID.randomUUID()}"
    val out = ByteArrayOutputStream()
    val crlf = "\r\n".toByteArray()

    for (part in parts) {
      out.write("--$boundary\r\n".toByteArray())

      val fileUri = part.fileUri
      if (fileUri != null) {
        val fileName = part.fileName ?: "file"
        val mimeType = part.mimeType ?: "application/octet-stream"
        out.write("Content-Disposition: form-data; name=\"${part.name}\"; filename=\"$fileName\"\r\n".toByteArray())
        out.write("Content-Type: $mimeType\r\n\r\n".toByteArray())

        val fileData = readFileBytes(fileUri)
        out.write(fileData)
      } else {
        val value = part.value ?: ""
        out.write("Content-Disposition: form-data; name=\"${part.name}\"\r\n\r\n".toByteArray())
        out.write(value.toByteArray(Charsets.UTF_8))
      }

      out.write(crlf)
    }

    out.write("--$boundary--\r\n".toByteArray())
    return Pair(out.toByteArray(), "multipart/form-data; boundary=$boundary")
  }

  private fun readFileBytes(uri: String): ByteArray {
    if (uri.startsWith("http://") || uri.startsWith("https://")) {
      val url = java.net.URL(uri)
      return url.openStream().use { it.readBytes() }
    }
    if (uri.startsWith("content://")) {
      val context = NitroModules.applicationContext
        ?: throw IllegalStateException("Cannot read content:// URI - no Android Context")
      val inputStream = context.contentResolver.openInputStream(Uri.parse(uri))
        ?: throw IllegalArgumentException("Cannot open content URI: $uri")
      return inputStream.use { it.readBytes() }
    }
    val path = if (uri.startsWith("file://")) uri.removePrefix("file://") else uri
    return File(path).readBytes()
  }
}
