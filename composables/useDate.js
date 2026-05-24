import { ref, onMounted, onUnmounted } from "vue";

// Store global para el tiempo actual (compartido entre todas las instancias)
const globalTimeStore = (() => {
  const currentTime = ref(Date.now());
  let intervalId = null;
  let subscriberCount = 0;

  const startGlobalTimer = () => {
    if (!intervalId) {
      intervalId = setInterval(() => {
        currentTime.value = Date.now();
      }, 5000); // Actualiza cada 5 segundos
    }
  };

  const stopGlobalTimer = () => {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };

  const subscribe = () => {
    subscriberCount++;
    if (subscriberCount === 1) {
      startGlobalTimer();
    }
  };

  const unsubscribe = () => {
    subscriberCount--;
    if (subscriberCount === 0) {
      stopGlobalTimer();
    }
  };

  return {
    currentTime,
    subscribe,
    unsubscribe,
  };
})();

/**
 * Composable para manejo de fechas y tiempos relativos
 */
export const useDate = () => {
  // Zona horaria: configurable via runtimeConfig.public.timeZone, fallback Santiago
  const config = useRuntimeConfig()
  const tenantTimeZone = config.public?.timeZone || 'America/Santiago';

  // Suscribirse al timer global cuando se monta el componente
  onMounted(() => {
    globalTimeStore.subscribe();
  });

  onUnmounted(() => {
    globalTimeStore.unsubscribe();
  });

  /**
   * Como la DB de Laravel suele enviar fechas "YYYY-MM-DD HH:mm:ss" sin zona horaria,
   * y siempre están en UTC, forzamos la lectura como UTC si no viene indicada.
   */
  const parseAsUTC = (input) => {
    if (!input) return new Date("");
    if (input instanceof Date) return input;

    let dateStr = String(input);
    if (!dateStr.includes('T') && dateStr.includes(' ')) {
      dateStr = dateStr.replace(' ', 'T');
    }
    // Si no termina en Z, ni tiene offset tipo +00:00, agregar Z
    if (!/(Z|[+-]\d{2}(:\d{2})?)$/.test(dateStr)) {
      dateStr += 'Z';
    }
    return new Date(dateStr);
  };

  /**
   * Obtiene la fecha formato YYYY-MM-DD según la zona horaria para comparaciones justas
   */
  const getTimeZoneDateString = (date) => {
    if (isNaN(date.getTime())) return "";
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: tenantTimeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    return formatter.format(date);
  };

  /**
   * Devuelve "hace X minutos/horas/días" en español.
   */
  const relativeTime = (input, watch = false) => {
    if (watch) {
      globalTimeStore.currentTime.value;
    }

    if (!input) return "";

    const then = parseAsUTC(input);
    if (isNaN(then.getTime())) return "";

    const now = new Date();
    const diffMs = now - then;
    const diffMin = Math.floor(diffMs / 60000);

    if (diffMin < 1) return "hace unos segundos";
    if (diffMin < 60) return `hace ${diffMin} ${diffMin === 1 ? "minuto" : "minutos"}`;

    const diffHrs = Math.floor(diffMin / 60);
    if (diffHrs < 24) return `hace ${diffHrs} ${diffHrs === 1 ? "hora" : "horas"}`;

    const diffDays = Math.floor(diffHrs / 24);
    if (diffDays < 30) return `hace ${diffDays} ${diffDays === 1 ? "día" : "días"}`;

    const diffMonths = Math.floor(diffDays / 30);
    if (diffMonths < 12) return `hace ${diffMonths} ${diffMonths === 1 ? "mes" : "meses"}`;

    const diffYears = Math.floor(diffMonths / 12);
    return `hace ${diffYears} ${diffYears === 1 ? "año" : "años"}`;
  };

  /**
   * Formatea la fecha para mostrar asegurando parseo UTC y formateo Santiago.
   */
  const formatDate = (input, options = {}) => {
    if (!input) return "";

    const d = parseAsUTC(input);
    if (isNaN(d.getTime())) return input;

    const formatter = new Intl.DateTimeFormat('es-CL', {
      timeZone: tenantTimeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });

    const parts = formatter.formatToParts(d);
    let day, month, year, hours, minutes;

    for (const part of parts) {
      if (part.type === 'day') day = part.value;
      if (part.type === 'month') month = part.value;
      if (part.type === 'year') year = part.value;
      if (part.type === 'hour') hours = part.value;
      if (part.type === 'minute') minutes = part.value;
    }

    if (hours === '24') hours = '00';

    if (options.onlyDate) return `${day} / ${month} / ${year}`;
    if (options.onlyTime) return `${hours}:${minutes}`;

    return `${day} / ${month} / ${year} ${hours}:${minutes}`;
  };

  const formatDateOnly = (input) => formatDate(input, { onlyDate: true });
  const formatTimeOnly = (input) => formatDate(input, { onlyTime: true });

  const isToday = (input) => {
    if (!input) return false;
    const date = parseAsUTC(input);
    return getTimeZoneDateString(new Date()) === getTimeZoneDateString(date);
  };

  const isYesterday = (input) => {
    if (!input) return false;
    const date = parseAsUTC(input);
    const yesterday = new Date(Date.now() - 86400000);
    return getTimeZoneDateString(yesterday) === getTimeZoneDateString(date);
  };

  const formatSmart = (input) => {
    if (!input) return "";

    if (isToday(input)) {
      return `Hoy a las ${formatTimeOnly(input)}`;
    }

    if (isYesterday(input)) {
      return `Ayer a las ${formatTimeOnly(input)}`;
    }

    return formatDate(input);
  };

  const getDayName = (input) => {
    if (!input) return "";
    const date = parseAsUTC(input);
    if (isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat('es-ES', { timeZone: tenantTimeZone, weekday: 'long' }).format(date);
  };

  const getMonthName = (input) => {
    if (!input) return "";
    const date = parseAsUTC(input);
    if (isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat('es-ES', { timeZone: tenantTimeZone, month: 'long' }).format(date);
  };

  const daysDiff = (date1, date2 = new Date()) => {
    const d1 = parseAsUTC(date1);
    const d2 = typeof date2 === 'string' ? parseAsUTC(date2) : new Date(date2);
    const diffTime = Math.abs(d2 - d1);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const isFuture = (input) => {
    if (!input) return false;
    return parseAsUTC(input) > new Date();
  };

  const isPast = (input) => {
    if (!input) return false;
    return parseAsUTC(input) < new Date();
  };

  return {
    relativeTime,
    formatDate,
    formatDateOnly,
    formatTimeOnly,
    formatSmart,
    isToday,
    isYesterday,
    getDayName,
    getMonthName,
    daysDiff,
    isFuture,
    isPast,
  };
};