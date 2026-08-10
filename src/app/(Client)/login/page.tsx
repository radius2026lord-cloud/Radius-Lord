"use client"
import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import Image from "next/image"
import { Eye, EyeOff, Globe } from "lucide-react"
import { Changa } from "next/font/google"
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip"

const changa = Changa({
  subsets: ["arabic"],
  weight: ["300", "400", "500", "600", "700"],
})

export default function LoginPage() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [language, setLanguage] = useState("ar")
  const [openDropdown, setOpenDropdown] = useState(false)
  const [cardVisible, setCardVisible] = useState(false)

  const [usernameError, setUsernameError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  useEffect(() => {
    setTimeout(() => setCardVisible(true), 100)
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()

    validateUsername(username)
    validatePassword(password)



    if (!usernameError && !passwordError) {
      try {



        const res = await fetch("/api/auth/login",

          {

            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password }),
            credentials: "include",
          });




        const data = await res.json()



        if (res.ok && data.success) {
          // ✅ تسجيل الدخول ناجح
          console.log("Login successful:", data.user)
          window.location.href = "/Dashboard"
        } else {
          // ❌ خطأ في تسجيل الدخول
          alert(data.message || "فشل تسجيل الدخول")
        }
      } catch (err) {
        console.error("Login request error:", err)
        alert("خطأ في الاتصال بالخادم")
      }
    }
  }

  const validateUsername = (value: string) => {
    const regex = /^[\u0600-\u06FFa-zA-Z0-9]*$/
    if (!value) {
      setUsernameError(language === "ar" ? "⚠️ الحقل فارغ" : "⚠️ Field is empty")
    } else if (!regex.test(value)) {
      setUsernameError(language === "ar" ? "⚠️ اسم المستخدم غير صالح" : "⚠️ Invalid username")
    } else {
      setUsernameError(null)
    }
  }

  const validatePassword = (value: string) => {
    if (!value) {
      setPasswordError(language === "ar" ? "⚠️ يرجى إدخال كلمة المرور" : "⚠️ Please enter your password")
    } else {
      setPasswordError(null)
    }
  }

  const interactiveClass =
    "transition-transform duration-500 ease-in-out hover:scale-105 focus:scale-105 hover:shadow-lg focus:shadow-lg"

  return (
    <TooltipProvider>
      <div className="flex min-h-screen flex-col items-center justify-between bg-gray-100">
        <div className="flex-grow flex items-center justify-center w-full">
          <Card
            className={`w-full max-w-3xl bg-white shadow-md rounded-3xl overflow-hidden 
                        transform transition-all duration-1000 ease-out 
                        ${cardVisible ? "opacity-100 scale-100" : "opacity-0 scale-95"}`}
          >
            <CardContent className="grid grid-cols-1 md:grid-cols-2 p-0 h-[80vh]">

              {/* شعار */}
              <div
                className={`flex flex-col items-center justify-center 
                            bg-gradient-to-br from-indigo-600 to-purple-700 text-white p-10 
                            transition-transform transition-opacity duration-1000 ease-in-out
                            ${language === "ar" ? "order-2 translate-x-6 opacity-100" : "order-1 -translate-x-6 opacity-100"}`}
              >
                <Image
                  src="https://upload.wikimedia.org/wikipedia/commons/a/a7/React-icon.svg"
                  alt="Network Logo"
                  width={120}
                  height={120}
                  className="mb-6"
                />
                <h1 className="text-3xl font-bold font-heading">My Network</h1>
                <p className="mt-2 text-lg opacity-80 font-sans">Secure Member Access</p>
              </div>

              {/* نموذج تسجيل الدخول */}
              <div
                className={`flex flex-col justify-center p-10 bg-white 
                            transition-transform transition-opacity duration-1000 ease-in-out
                            ${language === "ar" ? "order-1 items-end text-right " + changa.className : "order-2 items-start text-left font-sans"}`}
              >
                <div className="w-full max-w-sm">
                  <h2 className="text-2xl font-bold mb-6 font-heading">
                    {language === "ar" ? "تسجيل الدخول" : "Member Login"}
                  </h2>
                  <form onSubmit={handleLogin} className="space-y-6 w-full">
                    {/* اسم المستخدم */}
                    <div className="relative mt-4">
                      <Label htmlFor="username" className={language === "ar" ? changa.className : "font-sans"}>
                        {language === "ar" ? "اسم المستخدم" : "Username"}
                      </Label>
                      <Tooltip open={!!usernameError}>
                        <TooltipTrigger asChild>
                          <Input
                            id="username"
                            type="text"
                            placeholder={language === "ar" ? "أدخل اسمك" : "Enter your username"}
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            onBlur={(e) => validateUsername(e.target.value)}
                            className={`rounded-full px-4 py-3 border border-gray-300 w-full 
                    focus:border-purple-600 focus:ring-2 focus:ring-purple-600
                    ${interactiveClass} 
                    ${language === "ar" ? "text-right " + changa.className : "text-left font-sans"}`}
                          />
                        </TooltipTrigger>
                        <TooltipContent
                          side="top"
                          align={language === "ar" ? "start" : "end"}
                          className={`z-50 rounded-xl border border-purple-500/30 bg-purple-700/90 text-white text-xs px-3 py-2 shadow-lg backdrop-blur-md relative 
                  ${language === "ar" ? changa.className : "font-sans"}`}
                        >
                          {usernameError}
                          <div className="absolute w-2 h-2 bg-purple-700/90 rotate-45 left-1/2 -translate-x-1/2 -bottom-1"></div>
                        </TooltipContent>
                      </Tooltip>
                    </div>

                    {/* كلمة المرور */}
                    <div className="relative mt-4">
                      <Label htmlFor="password" className={language === "ar" ? changa.className : "font-sans"}>
                        {language === "ar" ? "كلمة المرور" : "Password"}
                      </Label>
                      <Tooltip open={!!passwordError}>
                        <TooltipTrigger asChild>
                          <div className="relative w-full">
                            <Input
                              id="password"
                              type={showPassword ? "text" : "password"}
                              placeholder={language === "ar" ? "أدخل كلمة المرور الخاصة بك" : "Enter your password"}
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              onBlur={(e) => validatePassword(e.target.value)}
                              className={`rounded-full px-4 py-3 border border-gray-300 w-full 
                      focus:border-purple-600 focus:ring-2 focus:ring-purple-600
                      ${interactiveClass} 
                      ${language === "ar" ? "text-right " + changa.className : "text-left font-sans"}`}
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className={`absolute inset-y-0 ${language === "ar" ? "left-3" : "right-3"} flex items-center text-gray-500 hover:text-gray-700`}
                            >
                              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent
                          side="top"
                          align={language === "ar" ? "start" : "end"}
                          className={`z-50 rounded-xl border border-purple-500/30 bg-purple-700/90 text-white text-xs px-3 py-2 shadow-lg backdrop-blur-md relative 
                  ${language === "ar" ? changa.className : "font-sans"}`}
                        >
                          {passwordError}
                          <div className="absolute w-2 h-2 bg-purple-700/90 rotate-45 left-1/2 -translate-x-1/2 -bottom-1"></div>
                        </TooltipContent>
                      </Tooltip>
                    </div>

                    {/* زر الدخول */}
                    <Button
                      type="submit"
                      className={`w-full rounded-full bg-gradient-to-br from-indigo-600 to-purple-700 text-white font-semibold shadow-md 
                                  ${interactiveClass}`}
                    >
                      {language === "ar" ? "دخول" : "Login"}
                    </Button>
                  </form>

                  {/* زر تغيير اللغة */}
                  <div className="mt-6 flex justify-center relative">
                    <button
                      onClick={() => setOpenDropdown(!openDropdown)}
                      className={`flex items-center gap-2 rounded-full border border-gray-300 bg-white px-6 py-2 text-sm text-gray-600 shadow-sm 
                                  hover:border-purple-500 focus:border-purple-600 focus:ring-2 focus:ring-purple-600
                                  ${interactiveClass}`}
                    >
                      <Globe size={18} className="text-purple-600 transition-transform duration-500 ease-in-out group-hover:rotate-180" />
                      {language === "ar" ? "العربية" : "English"}
                    </button>
                    <div
                      className={`absolute top-full mt-3 w-44 rounded-xl bg-white shadow-lg border border-gray-200 z-10 transition-all duration-500 ease-in-out ${openDropdown ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2 pointer-events-none"
                        }`}
                    >
                      <ul className="py-2">
                        <li
                          onClick={() => { setLanguage("ar"); setOpenDropdown(false); }}
                          className={`px-4 py-2 text-sm text-gray-700 hover:bg-purple-50 cursor-pointer ${changa.className}`}
                        >
                          🇸🇦 العربية
                        </li>
                        <li
                          onClick={() => { setLanguage("en"); setOpenDropdown(false); }}
                          className="px-4 py-2 text-sm text-gray-700 hover:bg-purple-50 cursor-pointer font-sans"
                        >
                          🇬🇧 English
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

            </CardContent>
          </Card>
        </div>

        {/* النص المثبت أسفل الصفحة */}
        <footer
          className={`w-full text-center text-gray-500 text-sm py-4 font-light tracking-wide ${language === "ar" ? changa.className : "font-sans"
            }`}
        >
          safwann ♥ /20236 ©
        </footer>
      </div>
    </TooltipProvider>
  )
}
