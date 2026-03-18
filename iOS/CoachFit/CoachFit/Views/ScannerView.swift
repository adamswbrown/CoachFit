import SwiftUI
import AVFoundation
import Vision

struct ScannerView: View {
    let onScan: (String) -> Void

    @State private var manualBarcode = ""
    @State private var cameraPermission: AVAuthorizationStatus = .notDetermined

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            switch cameraPermission {
            case .authorized:
                authorizedContent
            case .denied, .restricted:
                deniedContent
            case .notDetermined:
                Color.clear
            @unknown default:
                deniedContent
            }
        }
        .onAppear {
            checkPermission()
        }
    }

    // MARK: - Authorized Layout

    private var authorizedContent: some View {
        VStack(spacing: 0) {
            CameraPreview { barcode in
                onScan(barcode)
            }
            .ignoresSafeArea(edges: .top)

            manualEntryBar
        }
    }

    // MARK: - Denied Layout

    private var deniedContent: some View {
        VStack(spacing: 20) {
            Spacer()

            Image(systemName: "camera.fill")
                .font(.system(size: 48))
                .foregroundStyle(.secondary)

            Text("Camera Access Required")
                .font(.title2.bold())
                .foregroundStyle(.white)

            Text("Enable camera access in Settings to scan barcodes.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)

            Button("Open Settings") {
                if let url = URL(string: UIApplication.openSettingsURLString) {
                    UIApplication.shared.open(url)
                }
            }
            .buttonStyle(.borderedProminent)

            Spacer()

            manualEntryBar
        }
    }

    // MARK: - Manual Entry

    private var manualEntryBar: some View {
        HStack(spacing: 12) {
            TextField("Enter barcode manually", text: $manualBarcode)
                .keyboardType(.numberPad)
                .textFieldStyle(.roundedBorder)

            Button("Submit") {
                let trimmed = manualBarcode.trimmingCharacters(in: .whitespaces)
                guard !trimmed.isEmpty else { return }
                onScan(trimmed)
            }
            .buttonStyle(.borderedProminent)
            .disabled(manualBarcode.trimmingCharacters(in: .whitespaces).isEmpty)
        }
        .padding()
        .background(.ultraThinMaterial)
    }

    // MARK: - Permission

    private func checkPermission() {
        let status = AVCaptureDevice.authorizationStatus(for: .video)
        cameraPermission = status

        if status == .notDetermined {
            AVCaptureDevice.requestAccess(for: .video) { granted in
                DispatchQueue.main.async {
                    cameraPermission = granted ? .authorized : .denied
                }
            }
        }
    }
}

// MARK: - CameraPreview

private struct CameraPreview: UIViewControllerRepresentable {
    let onBarcodeDetected: (String) -> Void

    func makeUIViewController(context: Context) -> CameraViewController {
        let controller = CameraViewController()
        controller.onBarcodeDetected = onBarcodeDetected
        return controller
    }

    func updateUIViewController(_ uiViewController: CameraViewController, context: Context) {
        uiViewController.onBarcodeDetected = onBarcodeDetected
    }
}

// MARK: - CameraViewController

private final class CameraViewController: UIViewController, AVCaptureVideoDataOutputSampleBufferDelegate {
    var onBarcodeDetected: ((String) -> Void)?

    private let captureSession = AVCaptureSession()
    private var previewLayer: AVCaptureVideoPreviewLayer?
    private let videoOutput = AVCaptureVideoDataOutput()
    private let processingQueue = DispatchQueue(label: "com.askadam.CoachFit.barcode-scanner")

    private var lastScanTime: Date = .distantPast
    private let debounceInterval: TimeInterval = 2.0

    private lazy var barcodeRequest: VNDetectBarcodesRequest = {
        let request = VNDetectBarcodesRequest { [weak self] request, error in
            self?.handleBarcodeResults(request: request, error: error)
        }
        request.symbologies = [.ean13, .ean8, .upce]
        return request
    }()

    // MARK: - Lifecycle

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black
        configureCaptureSession()
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        previewLayer?.frame = view.bounds
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        startSession()
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        stopSession()
    }

    // MARK: - Session Setup

    private func configureCaptureSession() {
        captureSession.beginConfiguration()
        captureSession.sessionPreset = .high

        guard let camera = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back),
              let input = try? AVCaptureDeviceInput(device: camera),
              captureSession.canAddInput(input) else {
            captureSession.commitConfiguration()
            return
        }
        captureSession.addInput(input)

        videoOutput.setSampleBufferDelegate(self, queue: processingQueue)
        videoOutput.alwaysDiscardsLateVideoFrames = true

        guard captureSession.canAddOutput(videoOutput) else {
            captureSession.commitConfiguration()
            return
        }
        captureSession.addOutput(videoOutput)

        captureSession.commitConfiguration()

        let layer = AVCaptureVideoPreviewLayer(session: captureSession)
        layer.videoGravity = .resizeAspectFill
        view.layer.addSublayer(layer)
        previewLayer = layer
    }

    private func startSession() {
        guard !captureSession.isRunning else { return }
        processingQueue.async { [weak self] in
            self?.captureSession.startRunning()
        }
    }

    private func stopSession() {
        guard captureSession.isRunning else { return }
        processingQueue.async { [weak self] in
            self?.captureSession.stopRunning()
        }
    }

    // MARK: - AVCaptureVideoDataOutputSampleBufferDelegate

    func captureOutput(_ output: AVCaptureOutput,
                       didOutput sampleBuffer: CMSampleBuffer,
                       from connection: AVCaptureConnection) {
        guard Date().timeIntervalSince(lastScanTime) >= debounceInterval else { return }

        guard let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }

        let handler = VNImageRequestHandler(cvPixelBuffer: pixelBuffer, options: [:])
        try? handler.perform([barcodeRequest])
    }

    // MARK: - Barcode Handling

    private func handleBarcodeResults(request: VNRequest, error: Error?) {
        guard error == nil,
              let results = request.results as? [VNBarcodeObservation],
              let first = results.first,
              let payload = first.payloadStringValue,
              !payload.isEmpty else {
            return
        }

        guard Date().timeIntervalSince(lastScanTime) >= debounceInterval else { return }
        lastScanTime = Date()

        DispatchQueue.main.async { [weak self] in
            self?.onBarcodeDetected?(payload)
        }
    }
}
