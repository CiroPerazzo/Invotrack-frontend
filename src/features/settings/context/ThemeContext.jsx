import { useEffect, useState } from 'react'
import { ThemeContext } from '@/features/settings/context/theme-context'

const STORAGE_KEY = 'invotrack-theme'

function getInitialTheme() {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    document.documentElement.style.colorScheme = theme
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      // El tema sigue funcionando si el navegador bloquea el almacenamiento.
    }
  }, [theme])

  const toggleTheme = () => setTheme((current) => current === 'dark' ? 'light' : 'dark')

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}
