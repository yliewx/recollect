import ExpoModulesCore
import Vision
import Photos

enum PhotoEmbeddingError: Error, LocalizedError {
  case assetNotFound(String)
  case requestCancelled(String)
  case imageUnavailable(String)
  case noFeaturePrint
  case unexpectedElementType

  var errorDescription: String? {
    switch self {
    case .assetNotFound(let id):
      return "No photo library asset found for identifier \(id). It may have been deleted, or library access may have been revoked."
    case .requestCancelled(let id):
      return "Image request was cancelled for asset \(id)."
    case .imageUnavailable(let id):
      return "Could not load image data for asset \(id)."
    case .noFeaturePrint:
      return "Vision did not produce a feature print for this image."
    case .unexpectedElementType:
      return "Vision feature print had an unexpected element type (expected .float)."
    }
  }
}

public class PhotoEmbeddingModule: Module {
  public func definition() -> ModuleDefinition {
    Name("PhotoEmbedding")

    // Given a local PHAsset identifier, returns its whole-image visual feature
    // print as a plain array of floats. Runs entirely on-device -- no image
    // bytes are sent anywhere. AsyncFunction already dispatches this closure
    // to a background queue, so the synchronous Vision/Photos calls below are safe.
    AsyncFunction("extractEmbedding") { (assetId: String) -> [Float] in
      let image = try Self.loadCGImage(assetId: assetId)
      return try Self.featurePrint(for: image)
    }
  }

  // Resolve a PHAsset local identifier to a CGImage suitable for Vision.
  private static func loadCGImage(assetId: String) throws -> CGImage {
    let fetchResult = PHAsset.fetchAssets(withLocalIdentifiers: [assetId], options: nil)
    guard let asset = fetchResult.firstObject else {
      throw PhotoEmbeddingError.assetNotFound(assetId)
    }

    let options = PHImageRequestOptions()
    options.isSynchronous = true // safe: we're already off the main thread
    options.deliveryMode = .highQualityFormat
    options.resizeMode = .fast
    options.isNetworkAccessAllowed = true // allow iCloud-only assets to download

    // Vision doesn't need full resolution; a modest target size keeps extraction fast
    // without losing the signal the feature print relies on.
    let targetSize = CGSize(width: 512, height: 512)

    var resultImage: CGImage?
    var requestError: Error?

    PHImageManager.default().requestImage(
      for: asset,
      targetSize: targetSize,
      contentMode: .aspectFit,
      options: options
    ) { image, info in
      if let cancelled = info?[PHImageCancelledKey] as? Bool, cancelled {
        requestError = PhotoEmbeddingError.requestCancelled(assetId)
        return
      }
      if let error = info?[PHImageErrorKey] as? Error {
        requestError = error
        return
      }
      resultImage = image?.cgImage
    }

    if let requestError {
      throw requestError
    }
    guard let cgImage = resultImage else {
      throw PhotoEmbeddingError.imageUnavailable(assetId)
    }
    return cgImage
  }

  private static func featurePrint(for image: CGImage) throws -> [Float] {
    let request = VNGenerateImageFeaturePrintRequest()
    // Pinned explicitly (not left as Apple's default): Apple has changed the
    // underlying feature-print model between OS revisions, so pinning keeps
    // vectors comparable across a user's whole library even if they update iOS
    // mid-use. NOTE: elementCount below is not a fixed constant across iOS
    // versions even for this same pinned revision (observed to differ, e.g.
    // 2048 on iOS 16 vs 768 on iOS 17+) -- always read it dynamically, never
    // assume a size. The backend's `embedding` column is unconstrained for
    // exactly this reason (see postgres/init/05_embeddings.sql).
    request.revision = VNGenerateImageFeaturePrintRequestRevision1

    let handler = VNImageRequestHandler(cgImage: image, options: [:])
    try handler.perform([request])

    guard let observation = request.results?.first as? VNFeaturePrintObservation else {
      throw PhotoEmbeddingError.noFeaturePrint
    }

    // VNFeaturePrintObservation exposes raw bytes via `.data`, not a Float array
    // directly -- it must be interpreted according to elementType/elementCount.
    guard observation.elementType == .float else {
      throw PhotoEmbeddingError.unexpectedElementType
    }

    let count = observation.elementCount
    var floats = [Float](repeating: 0, count: count)
    observation.data.withUnsafeBytes { rawBuffer in
      let buffer = rawBuffer.bindMemory(to: Float.self)
      floats = Array(buffer.prefix(count))
    }
    return floats
  }
}
