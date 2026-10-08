import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Proof of concept translations for Settings
const resources = {
  en: {
    translation: {
      settings: {
        title: "Settings",
        language: "Language",
        language_desc: "Choose your preferred language for the dashboard.",
        gemini_key: "Gemini API Key",
        checking_key: "Checking shared key…",
        check_key_error: "Could not check shared key: {{error}}",
        key_saved: "Key saved successfully!",
        update_key: "Update API Key",
        paste_new_key: "Paste new Gemini API key",
        key_empty: "Key cannot be empty",
        cancel: "Cancel",
        save: "Save",
        saving: "Saving…",
        gemini_model: "Gemini Model",
        loading: "Loading…",
        model_saved: "Model saved successfully!",
        update_model: "Update Model",
        model_placeholder: "e.g. gemini-3.1-flash-lite",
        model_default_desc: "Enter the exact Gemini model string. Default fallback: gemini-3.1-flash-lite",
        model_empty: "Model name cannot be empty",
        manage_users: "Manage Users",
        no_users: "No users yet.",
        remove_user: "Remove user",
        add_user: "Add User",
        first_name: "First name",
        last_name: "Last name",
        password: "Password",
        email_optional: "Email (optional for now)",
        adding: "Adding…",
        user_created: "✅ User created",
        user_created_desc: "Username: {{username}} — share this and the password with them so they can log in.",
        admin_only: "Only System Managers, Owners, HR, and Accounts can update settings."
      },
      add_expense: {
        title: "Log an expense",
        receipt: "Receipt (optional)",
        attach_receipt: "Attach Receipt",
        cropping: "Cropping receipt…",
        remove: "Remove",
        reading: "Reading…",
        read_receipt: "Read receipt",
        re_read_receipt: "Re-read receipt",
        receipt_desc: "Auto-crops it and reads the amount, currency, vendor and category off it — everything below stays editable, or skip this and enter the amount manually.",
        several_receipts: "Got several receipts?",
        clear: "Clear",
        select_multiple: "Select multiple receipts",
        waiting: "Waiting…",
        batch_desc: "Each saved as its own expense under the Trip/Payment method below — amount, currency, vendor and category read automatically per receipt.",
        add_n_expenses: "Add {{count}} expense",
        add_n_expenses_plural: "Add {{count}} expenses",
        amount: "Amount",
        currency: "Currency",
        category: "Category",
        payment_method: "Payment method",
        which_card: "Which card",
        trip: "Trip",
        description: "Description (optional)",
        exchange_rate: "Exchange rate",
        resolve_rate: "Resolve rate",
        resolving: "Resolving…",
        fx_rate: "FX rate",
        inr_equivalent: "INR equivalent",
        add_expense_btn: "Add expense"
      }
    }
  },
  hi: {
    translation: {
      settings: {
        title: "सेटिंग्स",
        language: "भाषा",
        language_desc: "डैशबोर्ड के लिए अपनी पसंदीदा भाषा चुनें।",
        gemini_key: "जेमिनी एपीआई कुंजी",
        checking_key: "साझा कुंजी की जाँच की जा रही है…",
        check_key_error: "साझा कुंजी की जाँच नहीं की जा सकी: {{error}}",
        key_saved: "कुंजी सफलतापूर्वक सहेजी गई!",
        update_key: "एपीआई कुंजी अपडेट करें",
        paste_new_key: "नई जेमिनी एपीआई कुंजी पेस्ट करें",
        key_empty: "कुंजी खाली नहीं हो सकती",
        cancel: "रद्द करें",
        save: "सहेजें",
        saving: "सहेजा जा रहा है…",
        gemini_model: "जेमिनी मॉडल",
        loading: "लोड हो रहा है…",
        model_saved: "मॉडल सफलतापूर्वक सहेजा गया!",
        update_model: "मॉडल अपडेट करें",
        model_placeholder: "उदा. gemini-3.1-flash-lite",
        model_default_desc: "सटीक जेमिनी मॉडल स्ट्रिंग दर्ज करें। डिफ़ॉल्ट फॉलबैक: gemini-3.1-flash-lite",
        model_empty: "मॉडल का नाम खाली नहीं हो सकता",
        manage_users: "उपयोगकर्ता प्रबंधित करें",
        no_users: "अभी तक कोई उपयोगकर्ता नहीं।",
        remove_user: "उपयोगकर्ता हटाएं",
        add_user: "उपयोगकर्ता जोड़ें",
        first_name: "पहला नाम",
        last_name: "अंतिम नाम",
        password: "पासवर्ड",
        email_optional: "ईमेल (अभी के लिए वैकल्पिक)",
        adding: "जोड़ा जा रहा है…",
        user_created: "✅ उपयोगकर्ता बनाया गया",
        user_created_desc: "उपयोगकर्ता नाम: {{username}} — इसे और पासवर्ड को उनके साथ साझा करें ताकि वे लॉग इन कर सकें।",
        admin_only: "केवल सिस्टम मैनेजर, मालिक, एचआर और खाते सेटिंग्स अपडेट कर सकते हैं।"
      },
      add_expense: {
        title: "एक खर्च दर्ज करें",
        receipt: "रसीद (वैकल्पिक)",
        attach_receipt: "रसीद संलग्न करें",
        cropping: "रसीद काटी जा रही है…",
        remove: "हटाएं",
        reading: "पढ़ा जा रहा है…",
        read_receipt: "रसीद पढ़ें",
        re_read_receipt: "रसीद फिर से पढ़ें",
        receipt_desc: "यह इसे ऑटो-क्रॉप करता है और राशि, मुद्रा, विक्रेता और श्रेणी पढ़ता है - नीचे सब कुछ संपादन योग्य रहता है, या इसे छोड़ दें और मैन्युअल रूप से राशि दर्ज करें।",
        several_receipts: "कई रसीदें हैं?",
        clear: "साफ़ करें",
        select_multiple: "कई रसीदें चुनें",
        waiting: "प्रतीक्षा…",
        batch_desc: "प्रत्येक को ट्रिप/भुगतान विधि के तहत अपने खर्च के रूप में सहेजा गया — प्रत्येक रसीद के लिए राशि, मुद्रा, विक्रेता और श्रेणी स्वचालित रूप से पढ़ी जाती है।",
        add_n_expenses: "{{count}} खर्च जोड़ें",
        add_n_expenses_plural: "{{count}} खर्च जोड़ें",
        amount: "राशि",
        currency: "मुद्रा",
        category: "श्रेणी",
        payment_method: "भुगतान विधि",
        which_card: "कौन सा कार्ड",
        trip: "यात्रा",
        description: "विवरण (वैकल्पिक)",
        exchange_rate: "विनिमय दर",
        resolve_rate: "दर खोजें",
        resolving: "खोजा जा रहा है…",
        fx_rate: "विनिमय दर",
        inr_equivalent: "INR समकक्ष",
        add_expense_btn: "खर्च जोड़ें"
      }
    }
  },
  mr: {
    translation: {
      settings: {
        title: "सेटिंग्ज",
        language: "भाषा",
        language_desc: "डॅशबोर्डसाठी तुमची पसंतीची भाषा निवडा.",
        gemini_key: "जेमिनी एपीआय की",
        checking_key: "सामायिक की तपासत आहे…",
        check_key_error: "सामायिक की तपासता आली नाही: {{error}}",
        key_saved: "की यशस्वीरित्या जतन केली!",
        update_key: "एपीआय की अपडेट करा",
        paste_new_key: "नवीन जेमिनी एपीआय की पेस्ट करा",
        key_empty: "की रिक्त असू शकत नाही",
        cancel: "रद्द करा",
        save: "जतन करा",
        saving: "जतन करत आहे…",
        gemini_model: "जेमिनी मॉडेल",
        loading: "लोड करत आहे…",
        model_saved: "मॉडेल यशस्वीरित्या जतन केले!",
        update_model: "मॉडेल अपडेट करा",
        model_placeholder: "उदा. gemini-3.1-flash-lite",
        model_default_desc: "नेमकी जेमिनी मॉडेल स्ट्रिंग प्रविष्ट करा. डीफॉल्ट फॉलबॅक: gemini-3.1-flash-lite",
        model_empty: "मॉडेलचे नाव रिक्त असू शकत नाही",
        manage_users: "वापरकर्ते व्यवस्थापित करा",
        no_users: "अद्याप कोणतेही वापरकर्ते नाहीत.",
        remove_user: "वापरकर्ता काढा",
        add_user: "वापरकर्ता जोडा",
        first_name: "पहिले नाव",
        last_name: "आडनाव",
        password: "पासवर्ड",
        email_optional: "ईमेल (सध्यासाठी पर्यायी)",
        adding: "जोडत आहे…",
        user_created: "✅ वापरकर्ता तयार केला",
        user_created_desc: "वापरकर्तानाव: {{username}} — हे आणि पासवर्ड त्यांच्यासोबत सामायिक करा जेणेकरून ते लॉग इन करू शकतील.",
        admin_only: "केवळ सिस्टम मॅनेजर, मालक, एचआर आणि खाती सेटिंग्ज अपडेट करू शकतात."
      },
      add_expense: {
        title: "खर्च नोंदवा",
        receipt: "पावती (पर्यायी)",
        attach_receipt: "पावती जोडा",
        cropping: "पावती क्रॉप करत आहे…",
        remove: "काढून टाका",
        reading: "वाचत आहे…",
        read_receipt: "पावती वाचा",
        re_read_receipt: "पावती पुन्हा वाचा",
        receipt_desc: "हे आपोआप क्रॉप करते आणि रक्कम, चलन, विक्रेता आणि श्रेणी वाचते — खालील सर्व संपादन करण्यायोग्य राहते, किंवा हे वगळा आणि व्यक्तिचलितपणे रक्कम प्रविष्ट करा.",
        several_receipts: "अनेक पावत्या आहेत?",
        clear: "साफ करा",
        select_multiple: "अनेक पावत्या निवडा",
        waiting: "प्रतीक्षा…",
        batch_desc: "प्रत्येक ट्रिप/पेमेंट पद्धतीखाली स्वतःचा खर्च म्हणून जतन केला जातो — रक्कम, चलन, विक्रेता आणि श्रेणी प्रत्येक पावतीसाठी आपोआप वाचली जाते.",
        add_n_expenses: "{{count}} खर्च जोडा",
        add_n_expenses_plural: "{{count}} खर्च जोडा",
        amount: "रक्कम",
        currency: "चलन",
        category: "श्रेणी",
        payment_method: "पेमेंट पद्धत",
        which_card: "कोणते कार्ड",
        trip: "ट्रिप",
        description: "वर्णन (पर्यायी)",
        exchange_rate: "विनिमय दर",
        resolve_rate: "दर शोधा",
        resolving: "शोधत आहे…",
        fx_rate: "विनिमय दर",
        inr_equivalent: "INR समतुल्य",
        add_expense_btn: "खर्च जोडा"
      }
    }
  }
};

const i18nInstance = i18n.createInstance();
if (typeof window !== 'undefined') {
  i18nInstance.use(LanguageDetector);
}
i18nInstance
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false // react already safes from xss
    }
  });

export default i18nInstance;
