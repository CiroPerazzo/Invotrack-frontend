import BaseOcrAdapter from '@/features/ocr/adapters/BaseOcrAdapter'
import { supabase } from '@/lib/supabase'

/**
 * Gpt4VisionAdapter — usa GPT-4o Vision via Edge Function de Supabase.
 *
 * La API key de OpenAI vive en el servidor (Supabase Edge Function Secrets),
 * nunca llega al browser.
 *
 * @extends BaseOcrAdapter
 */
class Gpt4VisionAdapter extends BaseOcrAdapter {
  get providerName() {
    return 'gpt4v'
  }

  /**
   * Convierte un File a base64 (sin el prefijo data:...;base64,)
   * @param {File} file
   * @returns {Promise<string>}
   */
  _fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const base64 = reader.result.split(',')[1]
        resolve(base64)
      }
      reader.onerror = () => reject(new Error('No se pudo leer el archivo'))
      reader.readAsDataURL(file)
    })
  }

  /**
   * Extrae texto de una imagen o PDF de factura usando GPT-4o.
   *
   * @param {File} file - Factura (PDF, JPEG, PNG, WEBP)
   * @returns {Promise<import('./BaseOcrAdapter').OcrRawResult>}
   */
  async extractText(file) {
    let fileBase64
    try {
      fileBase64 = await this._fileToBase64(file)
    } catch (err) {
      throw new Error(`No se pudo leer el archivo: ${err.message}`, { cause: err })
    }

    const { data, error } = await supabase.functions.invoke('ocr-gpt4v', {
      body: {
        fileBase64,
        mimeType: file.type,
        fileName: file.name,
      },
    })

    if (error) {
      throw new Error(`Error al invocar la Edge Function ocr-gpt4v: ${error.message}`)
    }

    // La Edge Function puede retornar { error: "..." } con status 200
    // En ese caso data.rawText no existe — hay que detectarlo explícitamente
    if (data?.error) {
      throw new Error(`La Edge Function reportó un error: ${data.error}`)
    }

    if (!data?.rawText) {
      throw new Error(
        'La Edge Function no devolvió texto. Verificá que OPENAI_API_KEY esté configurada en los secrets de Supabase.'
      )
    }

    return {
      rawText: data.rawText,
      rawResponse: data?.rawResponse ?? {},
    }
  }
}

export default Gpt4VisionAdapter
