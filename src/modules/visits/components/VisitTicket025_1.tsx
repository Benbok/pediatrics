import React from 'react';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Visit, ChildProfile } from '../../../types';
import { Printer, Download } from 'lucide-react';
import { logger } from '../../../services/logger';

interface VisitTicket025_1Props {
    visit: Visit;
    child: ChildProfile;
    doctorName: string;
    onPrint?: () => void;
    onExportPdf?: () => void;
}

export const VisitTicket025_1: React.FC<VisitTicket025_1Props> = ({
    visit,
    child,
    doctorName,
    onPrint,
    onExportPdf,
}) => {
    const formatDate = (dateString?: string | null) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    const formatTime = (timeString?: string | null) => {
        if (!timeString) return '';
        return timeString;
    };

    const primaryDiagnosis = typeof visit.primaryDiagnosis === 'string'
        ? (visit.primaryDiagnosis ? JSON.parse(visit.primaryDiagnosis) : null)
        : visit.primaryDiagnosis;

    const handlePrint = () => {
        if (onPrint) {
            onPrint();
        } else {
            window.print();
        }
    };

    const handleExportPdf = async () => {
        if (onExportPdf) {
            onExportPdf();
        } else {
            // Fallback: используем window.electronAPI.exportPDF если доступен
            try {
                await window.electronAPI?.exportPDF?.({
                    templateId: 'visit-ticket-025-1',
                    data: { visit, child, doctorName },
                    metadata: {
                        title: 'Талон пациента 025-1/у',
                        createdAt: new Date(),
                        custom: {
                            subtitle: `№ ${visit.ticketNumber || visit.id}`,
                        }
                    },
                    options: {
                        pageSize: 'A4',
                        orientation: 'portrait',
                        margins: { top: 20, right: 15, bottom: 20, left: 15 },
                    }
                });
            } catch (err: any) {
                logger.error('[VisitTicket025_1] PDF export failed:', err);
                alert('Не удалось экспортировать PDF');
            }
        }
    };

    return (
        <Card className="p-6 print:p-4">
            <div className="flex items-center justify-between mb-6 print:hidden">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                    Талон пациента (форма 025-1/у)
                </h2>
                <div className="flex gap-2">
                    <Button
                        variant="secondary"
                        onClick={handlePrint}
                        leftIcon={<Printer className="w-4 h-4" />}
                    >
                        Печать
                    </Button>
                    <Button
                        variant="primary"
                        onClick={handleExportPdf}
                        leftIcon={<Download className="w-4 h-4" />}
                    >
                        Экспорт PDF
                    </Button>
                </div>
            </div>

            {/* Форма 025-1/у */}
            <div className="border-2 border-slate-900 dark:border-slate-100 p-6 space-y-4 bg-white text-black print:border-0 print:p-4">
                {/* Заголовок */}
                <div className="text-center border-b-2 border-slate-900 pb-2 mb-4">
                    <div className="text-sm font-bold mb-1">ФОРМА № 025-1/у</div>
                    <div className="text-xs">Талон пациента</div>
                </div>

                {/* Данные пациента */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <span className="font-bold">Фамилия, имя, отчество:</span>
                        <div className="border-b border-slate-900 min-h-[20px] mt-1">
                            {child.surname} {child.name} {child.patronymic || ''}
                        </div>
                    </div>
                    <div>
                        <span className="font-bold">Дата рождения:</span>
                        <div className="border-b border-slate-900 min-h-[20px] mt-1">
                            {formatDate(child.birthDate)}
                        </div>
                    </div>
                </div>

                {/* Данные приема */}
                <div className="grid grid-cols-3 gap-4 text-sm mt-4">
                    <div>
                        <span className="font-bold">Дата приема:</span>
                        <div className="border-b border-slate-900 min-h-[20px] mt-1">
                            {formatDate(visit.visitDate)}
                        </div>
                    </div>
                    <div>
                        <span className="font-bold">Время приема:</span>
                        <div className="border-b border-slate-900 min-h-[20px] mt-1">
                            {formatTime(visit.visitTime) || '—'}
                        </div>
                    </div>
                    <div>
                        <span className="font-bold">Номер талона:</span>
                        <div className="border-b border-slate-900 min-h-[20px] mt-1">
                            {visit.ticketNumber || '—'}
                        </div>
                    </div>
                </div>

                {/* Тип приема */}
                <div className="mt-4">
                    <span className="font-bold text-sm">Тип приема:</span>
                    <div className="border-b border-slate-900 min-h-[20px] mt-1">
                        {visit.visitType === 'primary' && 'Первичный'}
                        {visit.visitType === 'followup' && 'Повторный'}
                        {visit.visitType === 'consultation' && 'Консультация'}
                        {visit.visitType === 'emergency' && 'Экстренный'}
                        {visit.visitType === 'urgent' && 'Неотложный'}
                        {!visit.visitType && '—'}
                    </div>
                </div>

                {/* Диагноз */}
                <div className="mt-4">
                    <span className="font-bold text-sm">Диагноз:</span>
                    <div className="border-b border-slate-900 min-h-[40px] mt-1">
                        {primaryDiagnosis ? (
                            <div>
                                {primaryDiagnosis.code ? (
                                    <><span className="font-mono">{primaryDiagnosis.code}</span> - </>
                                ) : null}
                                {primaryDiagnosis.nameRu}
                            </div>
                        ) : (
                            '—'
                        )}
                    </div>
                </div>

                {/* Впервые выявленное заболевание / Травма */}
                <div className="grid grid-cols-2 gap-4 text-sm mt-4">
                    <div>
                        <span className="font-bold">Впервые выявленное заболевание:</span>
                        <div className="border-b border-slate-900 min-h-[20px] mt-1">
                            {visit.isFirstTimeDiagnosis ? '✓ Да' : '—'}
                        </div>
                    </div>
                    <div>
                        <span className="font-bold">Наличие травмы:</span>
                        <div className="border-b border-slate-900 min-h-[20px] mt-1">
                            {visit.isTrauma ? '✓ Да' : '—'}
                        </div>
                    </div>
                </div>

                {/* Врач */}
                <div className="mt-4">
                    <span className="font-bold text-sm">Врач:</span>
                    <div className="border-b border-slate-900 min-h-[20px] mt-1">
                        {doctorName}
                    </div>
                </div>

                {/* Подпись врача */}
                <div className="mt-8 text-right">
                    <div className="inline-block text-center">
                        <div className="border-b border-slate-900 w-48 mb-1"></div>
                        <div className="text-xs">Подпись врача</div>
                    </div>
                </div>

                {/* Примечания */}
                {visit.notes && (
                    <div className="mt-4 text-sm">
                        <span className="font-bold">Примечания:</span>
                        <div className="border border-slate-900 min-h-[60px] p-2 mt-1">
                            {visit.notes}
                        </div>
                    </div>
                )}
            </div>
        </Card>
    );
};
