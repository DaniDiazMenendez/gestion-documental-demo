import { Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ArchitecturePage } from './pages/ArchitecturePage';
import { AuditPage } from './pages/AuditPage';
import { DashboardPage } from './pages/DashboardPage';
import { DocumentsPage } from './pages/DocumentsPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { SearchPage } from './pages/SearchPage';
import { UploadPage } from './pages/UploadPage';
import { ValidationPage } from './pages/ValidationPage';

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="documentos" element={<DocumentsPage />} />
        <Route path="cargar" element={<UploadPage />} />
        <Route path="validacion" element={<ValidationPage />} />
        <Route path="busqueda" element={<SearchPage />} />
        <Route path="auditoria" element={<AuditPage />} />
        <Route path="arquitectura" element={<ArchitecturePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
