import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type Task = {
  id: string; title: string; status: string; priority: string; due_date: string | null;
};

const priorityColors: Record<string, string> = { low: 'bg-muted', medium: 'bg-blue-100 text-blue-800', high: 'bg-orange-100 text-orange-800', urgent: 'bg-red-100 text-red-800' };

export default function CalendarView() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    supabase.from('tasks').select('id, title, status, priority, due_date').not('due_date', 'is', null)
      .then(({ data }) => setTasks((data as Task[]) || []));
  }, []);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date().toISOString().split('T')[0];

  const days = Array.from({ length: 42 }, (_, i) => {
    const day = i - firstDay + 1;
    if (day < 1 || day > daysInMonth) return null;
    return day;
  });

  function getTasksForDay(day: number) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return tasks.filter(t => t.due_date === dateStr);
  }

  const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-foreground">Calendário</h1>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={() => setCurrentDate(new Date(year, month - 1, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <CardTitle>{currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</CardTitle>
            <Button variant="ghost" size="icon" onClick={() => setCurrentDate(new Date(year, month + 1, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-px">
            {weekdays.map(d => (
              <div key={d} className="p-2 text-center text-sm font-medium text-muted-foreground">{d}</div>
            ))}
            {days.map((day, i) => {
              if (!day) return <div key={i} className="min-h-[80px] p-1" />;
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const isToday = dateStr === today;
              const dayTasks = getTasksForDay(day);
              return (
                <div key={i} className={`min-h-[80px] border rounded-md p-1 ${isToday ? 'bg-primary/10 border-primary' : 'border-border'}`}>
                  <span className={`text-xs font-medium ${isToday ? 'text-primary' : 'text-foreground'}`}>{day}</span>
                  <div className="space-y-0.5 mt-1">
                    {dayTasks.slice(0, 3).map(t => (
                      <div key={t.id} className={`text-xs truncate rounded px-1 py-0.5 ${priorityColors[t.priority]}`}>
                        {t.title}
                      </div>
                    ))}
                    {dayTasks.length > 3 && <span className="text-xs text-muted-foreground">+{dayTasks.length - 3}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
