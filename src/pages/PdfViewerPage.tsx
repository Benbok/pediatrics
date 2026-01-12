import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { PdfViewer } from '../components/PdfViewer/PdfViewer';

export const PdfViewerPage: React.FC = () => {
    const [searchParams] = useSearchParams();
    const filePath = searchParams.get('file');
    const page = parseInt(searchParams.get('page') || '1', 10);

    if (!filePath) {
        return (
            <div className="flex items-center justify-center h-screen bg-slate-900 text-white">
                <p>Файл не указан</p>
            </div>
        );
    }

    return <PdfViewer filePath={decodeURIComponent(filePath)} initialPage={page} />;
};
