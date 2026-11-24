import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';

export function NotFoundPage() {
  return (
    <div className="card empty tall">
      <Icon name="file" size={34} />
      <h3>La página que buscás no existe</h3>
      <p className="muted">Revisá la dirección o volvé al panel general.</p>
      <Link to="/" className="btn btn-primary">
        Ir al panel general
      </Link>
    </div>
  );
}
