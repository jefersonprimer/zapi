export function isSameDay(dateStr1: string, dateStr2: string): boolean {
  if (!dateStr1 || !dateStr2) return false;
  const d1 = new Date(dateStr1);
  const d2 = new Date(dateStr2);
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return false;
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

export function getDateLabel(dateStr: string): string {
  const msgDate = new Date(dateStr);
  if (isNaN(msgDate.getTime())) return "";

  const today = new Date();

  // Clear times
  const dMsg = new Date(
    msgDate.getFullYear(),
    msgDate.getMonth(),
    msgDate.getDate(),
  );
  const dToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );

  const diffTime = dToday.getTime() - dMsg.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return "Hoje";
  }
  if (diffDays === 1) {
    return "Ontem";
  }
  if (diffDays === 2) {
    return "Anteontem";
  }
  if (diffDays > 2 && diffDays < 7) {
    return "Esta semana";
  }
  if (diffDays >= 7 && diffDays < 14) {
    return "Semana passada";
  }

  // Check if it's the same month and year
  if (
    dMsg.getFullYear() === dToday.getFullYear() &&
    dMsg.getMonth() === dToday.getMonth()
  ) {
    return "Este mês";
  }

  // Check if it's last month
  const isLastMonth =
    (dToday.getFullYear() === dMsg.getFullYear() &&
      dToday.getMonth() - dMsg.getMonth() === 1) ||
    (dToday.getFullYear() - dMsg.getFullYear() === 1 &&
      dToday.getMonth() === 0 &&
      dMsg.getMonth() === 11);

  if (isLastMonth) {
    return "Mês passado";
  }

  const months = [
    "janeiro",
    "fevereiro",
    "março",
    "abril",
    "maio",
    "junho",
    "julho",
    "agosto",
    "setembro",
    "outubro",
    "novembro",
    "dezembro",
  ];
  return `${dMsg.getDate()} de ${months[dMsg.getMonth()]} de ${dMsg.getFullYear()}`;
}
