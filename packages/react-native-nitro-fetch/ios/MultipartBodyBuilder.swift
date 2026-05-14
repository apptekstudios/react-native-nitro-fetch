import Foundation

enum MultipartBodyBuilder {
  /// Builds an RFC 2046 multipart/form-data body and returns `(body, contentType)`.
  /// File URIs are read synchronously. `http(s)://` source URIs block the calling thread.
  static func build(parts: [NitroFormDataPart]) throws -> (Data, String) {
    let boundary = "NitroFetch-\(UUID().uuidString)"
    var body = Data()
    let crlf = "\r\n"

    for part in parts {
      body.append("--\(boundary)\(crlf)".data(using: .utf8)!)

      if let fileUri = part.fileUri {
        let fileName = part.fileName ?? "file"
        let mimeType = part.mimeType ?? "application/octet-stream"
        body.append("Content-Disposition: form-data; name=\"\(part.name)\"; filename=\"\(fileName)\"\(crlf)".data(using: .utf8)!)
        body.append("Content-Type: \(mimeType)\(crlf)\(crlf)".data(using: .utf8)!)

        let fileData = try readFileData(fileUri)
        body.append(fileData)
      } else {
        let value = part.value ?? ""
        body.append("Content-Disposition: form-data; name=\"\(part.name)\"\(crlf)\(crlf)".data(using: .utf8)!)
        body.append(value.data(using: .utf8)!)
      }

      body.append(crlf.data(using: .utf8)!)
    }

    body.append("--\(boundary)--\(crlf)".data(using: .utf8)!)
    return (body, "multipart/form-data; boundary=\(boundary)")
  }

  private static func readFileData(_ uri: String) throws -> Data {
    if uri.hasPrefix("http://") || uri.hasPrefix("https://") {
      guard let url = URL(string: uri) else {
        throw NSError(domain: "NitroFetch", code: -4, userInfo: [NSLocalizedDescriptionKey: "Invalid URL: \(uri)"])
      }
      return try Data(contentsOf: url)
    }
    let path = uri.hasPrefix("file://") ? String(uri.dropFirst(7)) : uri
    guard let data = FileManager.default.contents(atPath: path) else {
      throw NSError(domain: "NitroFetch", code: -4, userInfo: [NSLocalizedDescriptionKey: "Cannot read file at: \(uri)"])
    }
    return data
  }
}
