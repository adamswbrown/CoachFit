import Foundation

class NetworkService {
    static let shared = NetworkService()
    
    private let baseURL = "http://localhost:3000"
    private let session = URLSession.shared
    
    private init() {}
    
    struct PairingResponse: Codable {
        let clientId: String
        
        enum CodingKeys: String, CodingKey {
            case clientId = "client_id"
        }
    }
    
    struct IngestResponse: Codable {
        let inserted: Int
        let duplicates: Int
        let errors: [IngestError]
    }
    
    struct IngestError: Codable {
        let workout: [String: Any]?
        let metric: [String: Any]?
        let errors: [String]
        
        private enum CodingKeys: String, CodingKey {
            case workout, metric, errors
        }
        
        init(from decoder: Decoder) throws {
            let container = try decoder.container(keyedBy: CodingKeys.self)
            errors = try container.decode([String].self, forKey: .errors)
            
            if let workoutDict = try? container.decode([String: Any].self, forKey: .workout) {
                workout = workoutDict
                metric = nil
            } else if let metricDict = try? container.decode([String: Any].self, forKey: .metric) {
                workout = nil
                metric = metricDict
            } else {
                workout = nil
                metric = nil
            }
        }
    }
    
    enum NetworkError: Error, LocalizedError {
        case invalidURL
        case noData
        case decodingError(Error)
        case httpError(Int, String)
        case networkError(Error)
        
        var errorDescription: String? {
            switch self {
            case .invalidURL:
                return "Invalid URL"
            case .noData:
                return "No data received"
            case .decodingError(let error):
                return "Decoding error: \(error.localizedDescription)"
            case .httpError(let code, let message):
                return "HTTP \(code): \(message)"
            case .networkError(let error):
                return "Network error: \(error.localizedDescription)"
            }
        }
    }
    
    func pair(pairingCode: String, completion: @escaping (Result<PairingResponse, NetworkError>) -> Void) {
        guard let url = URL(string: "\(baseURL)/pair") else {
            completion(.failure(.invalidURL))
            return
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body = ["pairing_code": pairingCode]
        
        do {
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
        } catch {
            completion(.failure(.networkError(error)))
            return
        }
        
        performRequest(request: request) { result in
            switch result {
            case .success(let data):
                do {
                    let response = try JSONDecoder().decode(PairingResponse.self, from: data)
                    completion(.success(response))
                } catch {
                    completion(.failure(.decodingError(error)))
                }
            case .failure(let error):
                completion(.failure(error))
            }
        }
    }
    
    func ingestWorkouts(clientId: String, workouts: [WorkoutData], completion: @escaping (Result<IngestResponse, NetworkError>) -> Void) {
        guard let url = URL(string: "\(baseURL)/ingest/workouts") else {
            completion(.failure(.invalidURL))
            return
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body: [String: Any] = [
            "client_id": clientId,
            "workouts": workouts.map { $0.toDictionary() }
        ]
        
        do {
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
        } catch {
            completion(.failure(.networkError(error)))
            return
        }
        
        performRequest(request: request) { result in
            switch result {
            case .success(let data):
                do {
                    let response = try JSONDecoder().decode(IngestResponse.self, from: data)
                    completion(.success(response))
                } catch {
                    completion(.failure(.decodingError(error)))
                }
            case .failure(let error):
                completion(.failure(error))
            }
        }
    }
    
    func ingestProfile(clientId: String, metrics: [ProfileMetricData], completion: @escaping (Result<IngestResponse, NetworkError>) -> Void) {
        guard let url = URL(string: "\(baseURL)/ingest/profile") else {
            completion(.failure(.invalidURL))
            return
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body: [String: Any] = [
            "client_id": clientId,
            "metrics": metrics.map { $0.toDictionary() }
        ]
        
        do {
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
        } catch {
            completion(.failure(.networkError(error)))
            return
        }
        
        performRequest(request: request) { result in
            switch result {
            case .success(let data):
                do {
                    let response = try JSONDecoder().decode(IngestResponse.self, from: data)
                    completion(.success(response))
                } catch {
                    completion(.failure(.decodingError(error)))
                }
            case .failure(let error):
                completion(.failure(error))
            }
        }
    }
    
    private func performRequest(request: URLRequest, completion: @escaping (Result<Data, NetworkError>) -> Void) {
        session.dataTask(with: request) { data, response, error in
            if let error = error {
                completion(.failure(.networkError(error)))
                return
            }
            
            guard let httpResponse = response as? HTTPURLResponse else {
                completion(.failure(.noData))
                return
            }
            
            guard let data = data else {
                completion(.failure(.noData))
                return
            }
            
            if httpResponse.statusCode >= 200 && httpResponse.statusCode < 300 {
                completion(.success(data))
            } else {
                var errorMessage = "HTTP Error \(httpResponse.statusCode)"
                if let responseDict = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                   let message = responseDict["error"] as? String {
                    errorMessage = message
                }
                completion(.failure(.httpError(httpResponse.statusCode, errorMessage)))
            }
        }.resume()
    }
}

// Data structures for API communication
struct WorkoutData {
    let workoutType: String
    let startTime: String
    let endTime: String
    let durationSeconds: Int
    let caloriesActive: Int?
    let distanceMeters: Double?
    let avgHeartRate: Int?
    let sourceDevice: String?
    let source: String
    
    func toDictionary() -> [String: Any] {
        var dict: [String: Any] = [
            "workout_type": workoutType,
            "start_time": startTime,
            "end_time": endTime,
            "duration_seconds": durationSeconds,
            "source": source
        ]
        
        if let calories = caloriesActive {
            dict["calories_active"] = calories
        }
        if let distance = distanceMeters {
            dict["distance_meters"] = distance
        }
        if let heartRate = avgHeartRate {
            dict["avg_heart_rate"] = heartRate
        }
        if let device = sourceDevice {
            dict["source_device"] = device
        }
        
        return dict
    }
}

struct ProfileMetricData {
    let metric: String
    let value: Double
    let unit: String
    let measuredAt: String
    let source: String
    
    func toDictionary() -> [String: Any] {
        return [
            "metric": metric,
            "value": value,
            "unit": unit,
            "measured_at": measuredAt,
            "source": source
        ]
    }
}