import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import LoginPage from "./pages/LoginPage"

// Protected Route — login ke bina andar nahi ja sakte
function ProtectedRoute({ children }) {
  const token = localStorage.getItem("access_token")
  if (!token) {
    return <Navigate to="/" replace />
  }
  return children
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<LoginPage />} />

        {/* Protected Routes — baad mein add karenge */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                  <h1 className="text-3xl font-bold text-blue-600">
                    BillingMars
                  </h1>
                  <p className="text-gray-500 mt-2">
                    Dashboard coming soon! 🚀
                  </p>
                </div>
              </div>
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}

export default App