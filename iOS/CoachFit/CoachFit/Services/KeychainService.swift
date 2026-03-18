import Foundation
import Security

enum KeychainService {
    private static let service = "com.askadam.CoachFit"

    private enum Key {
        static let deviceToken = "deviceToken"
        static let clientId = "clientId"
        static let clientName = "clientName"
        static let coachName = "coachName"
    }

    // MARK: - Device Token

    static var deviceToken: String? {
        get { read(key: Key.deviceToken) }
        set {
            if let newValue {
                save(key: Key.deviceToken, value: newValue)
            } else {
                delete(key: Key.deviceToken)
            }
        }
    }

    static var clientId: String? {
        get { read(key: Key.clientId) }
        set {
            if let newValue {
                save(key: Key.clientId, value: newValue)
            } else {
                delete(key: Key.clientId)
            }
        }
    }

    static var clientName: String? {
        get { read(key: Key.clientName) }
        set {
            if let newValue {
                save(key: Key.clientName, value: newValue)
            } else {
                delete(key: Key.clientName)
            }
        }
    }

    static var coachName: String? {
        get { read(key: Key.coachName) }
        set {
            if let newValue {
                save(key: Key.coachName, value: newValue)
            } else {
                delete(key: Key.coachName)
            }
        }
    }

    static func clearAll() {
        deviceToken = nil
        clientId = nil
        clientName = nil
        coachName = nil
    }

    // MARK: - Private

    private static func save(key: String, value: String) {
        let data = Data(value.utf8)
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
        ]
        SecItemDelete(query as CFDictionary)

        var addQuery = query
        addQuery[kSecValueData as String] = data
        addQuery[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        SecItemAdd(addQuery as CFDictionary, nil)
    }

    private static func read(key: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        guard status == errSecSuccess, let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    private static func delete(key: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
        ]
        SecItemDelete(query as CFDictionary)
    }
}
