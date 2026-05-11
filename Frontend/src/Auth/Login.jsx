import React, { useEffect, useState } from "react";
import LoginPic from "../assets/Login.jpg";
import Logo from "../assets/Updated-logo.png";
import { FcGoogle } from "react-icons/fc";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import FullScreenLoader from "../components/FullScreenLoader";
import api from "../services/api";
import { toast } from "react-toastify";

function Login() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get("token");
    const status = urlParams.get("status");
    const message = urlParams.get("message");
    const errorType = urlParams.get("error_type");
    const role = urlParams.get("role");

    // Handle different status messages
    if (status === "error") {
      setErrorMessage(message || "Authentication failed");
      toast.error(message || "Authentication failed");
      setLoading(false);
      return;
    }

    if (status === "already_authorized") {
      toast.info(message || "Previous session terminated. Please log in again.");
      setLoading(false);
      return;
    }

    if (token) {
      // Prevent duplicate processing
      if (localStorage.getItem("authToken")) {
        return;
      }
      localStorage.setItem("authToken", token);
      if (role) {
        localStorage.setItem("role", role);
      }
      setLoading(true);

      api.get("/user", {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((response) => {
          const { role, ...user } = response.data;
          localStorage.setItem("role", role);
          localStorage.setItem("user", JSON.stringify(user));
          if (user.programCode) {
            localStorage.setItem("programCode", user.programCode);
          }
          if (user.id) {
            localStorage.setItem("instructorId", user.id);
          }
          const dashboardRoutes = {
            Student: "/SDashboard",
            Instructor: "/InstructorDashboard",
            Admin: "/AdminDashboard",
          };

          toast.success("Successfully logged in!");
          // Clean up URL to prevent re-processing
          window.history.replaceState({}, document.title, "/login");
          navigate(dashboardRoutes[role] || "/", { replace: true });
        })
        .catch((error) => {
          const errorMsg = error.response?.data?.message || "Authentication failed";
          setErrorMessage(errorMsg);
          toast.error(errorMsg);
          localStorage.removeItem("authToken");
          localStorage.removeItem("role");
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [navigate]);

  const handleGoogleLogin = () => {
    setLoading(true);
    setErrorMessage("");
    window.location.href = `${import.meta.env.VITE_API_URL}/auth/google`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#f8fafc] to-[#eef2ff] p-4">
      {loading && <FullScreenLoader />}

      {!loading && (
        <div className="flex flex-col md:flex-row w-full max-w-6xl bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100 relative transition-all duration-300 hover:shadow-2xl animate-fade-in">
          {/* Mobile Gradient Overlay */}
          <div className="md:hidden absolute inset-0 bg-gradient-to-t from-[#1F3463]/90 via-[#1F3463]/70 to-[#1F3463]/30 z-0 rounded-[2rem]" />
          
          {/* Image Section (Desktop only) */}
          <div className="hidden md:block md:w-1/2 relative overflow-hidden">
            <img 
              src={LoginPic} 
              alt="Login background" 
              className="w-full h-full object-cover transform hover:scale-105 transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#1F3463]/90 to-[#1F3463]/30 flex items-end p-10">
              <div className="space-y-4">
                <h2 className="text-4xl font-bold text-white mb-2">Welcome Back!</h2>
                <p className="text-white/90 text-lg max-w-md">Sign in to access the Teachers' Performance Evaluation System and manage your evaluations</p>
                <div className="w-16 h-1 bg-white/50 rounded-full mt-4"></div>
              </div>
            </div>
          </div>

          {/* Form Section */}
          <div className="w-full md:w-[480px] lg:w-[520px] xl:w-[560px] p-8 md:p-12 flex flex-col justify-center mx-auto min-h-[520px] md:min-h-[600px] lg:min-h-[700px] relative z-10 bg-white">
            <div className="text-center mb-10">
              <div className="flex justify-center mb-6 transform hover:scale-105 transition-transform duration-300">
                <img src={Logo} alt="LVCC Logo" className="w-28 h-28" />
              </div>
              <h1 className="text-4xl font-bold text-[#1F3463] mb-2">LVCC</h1>
              <h2 className="text-xl font-semibold text-gray-700 mb-3">TEACHERS' PERFORMANCE EVALUATION SYSTEM</h2>
              <p className="text-gray-600">Sign in using your LV account</p>
            </div>

            {/* Error Message Display */}
            {errorMessage && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                {errorMessage}
              </div>
            )}

            {/* Google Sign In Button */}
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full flex items-center justify-center space-x-3 py-4 px-6 border border-gray-200 rounded-xl font-medium text-gray-700 hover:bg-gray-50 transition-all duration-300 shadow-sm hover:shadow-md bg-white hover:-translate-y-0.5 active:translate-y-0 group disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FcGoogle className="w-6 h-6 transform group-hover:scale-110 transition-transform" />
                <span className="group-hover:text-[#1F3463] transition-colors">
                  {loading ? "Signing in..." : "Sign in with Google"}
                </span>
              </button>
            </div>

            <div className="mt-10 text-center text-sm text-gray-500">
              <p className="mb-2">Don't have an LV account?</p>
              <a 
                href="mailto:admin@lvcc.edu.ph" 
                className="inline-flex items-center font-medium text-[#1F3463] hover:text-[#1A2C56] underline underline-offset-4 decoration-[#1F3463]/30 hover:decoration-[#1F3463]/50 transition-colors"
              >
                Contact LVCC Administrator
                <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Login;