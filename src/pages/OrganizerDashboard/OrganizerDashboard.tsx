import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabaseClient'
import type { Tournament, AppUser } from '../../types'
import './OrganizerDashboard.css'

export default function OrganizerDashboard() {
    const [tournaments, setTournaments] = useState<Tournament[]>([])
    const [showModal, setShowModal] = useState(false)
    const navigate = useNavigate()

    const fetchMyTournaments = async () => {
        const user: AppUser = JSON.parse(localStorage.getItem('user')!)
        const { data } = await supabase.from('tournaments').select('*').eq('organizer_id', user.id)
        setTournaments(data || [])
    }

    useEffect(() => { fetchMyTournaments() }, [])

    const handleCreate = async (e: React.SubmitEvent<HTMLFormElement>) => {
        e.preventDefault()
        const user: AppUser = JSON.parse(localStorage.getItem('user')!)
        const form = e.currentTarget

        await supabase.from('tournaments').insert([{
            title: (form.elements.namedItem('title') as HTMLInputElement).value,
            city: (form.elements.namedItem('city') as HTMLInputElement).value,
            start_date: (form.elements.namedItem('start_date') as HTMLInputElement).value,
            start_time: (form.elements.namedItem('start_time') as HTMLInputElement).value,
            end_datetime: (form.elements.namedItem('end_datetime') as HTMLInputElement).value,
            time_control: (form.elements.namedItem('time_control') as HTMLSelectElement).value,
            total_spots: parseInt((form.elements.namedItem('total_spots') as HTMLInputElement).value),
            total_rounds: parseInt((form.elements.namedItem('total_rounds') as HTMLInputElement).value),
            organizer_id: user.id
        }])
        setShowModal(false)
        fetchMyTournaments()
    }

    return (
        <div className="container">
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <h2>Мои турниры</h2>
                <button className="btn-primary" onClick={() => setShowModal(true)}>+ Создать турнир</button>
            </div>

            <div className="grid">
                {tournaments.map(t => (
                    <div key={t.id} className="card">
                        <h3>{t.title}</h3>
                        <p>Город: {t.city} | Формат: {t.time_control}</p>
                        <button className="btn-primary" style={{ marginTop: '10px' }} onClick={() => navigate(`/admin/manage/${t.id}`)}>Управление</button>
                    </div>
                ))}
            </div>

            {showModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h2 style={{ color: '#660000', marginBottom: 20 }}>Создание карточки турнира</h2>
                        <form onSubmit={handleCreate}>
                            <input name="title" placeholder="Название турнира" required />
                            <input name="city" placeholder="Город" required />
                            <div className="form-grid">
                                <input name="start_date" type="date" required title="Дата начала" />
                                <input name="start_time" type="time" required title="Время начала" />
                                <input name="end_datetime" type="datetime-local" required title="Дата и время окончания" />
                                <select name="time_control" required>
                                    <option value="блиц">Блиц</option>
                                    <option value="рапид">Рапид</option>
                                    <option value="классика">Классика</option>
                                </select>
                                <input name="total_spots" type="number" placeholder="Всего мест" required />
                                <input name="total_rounds" type="number" placeholder="Количество туров" required />
                            </div>
                            <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
                                <button type="submit" className="btn-primary">Сохранить</button>
                                <button type="button" onClick={() => setShowModal(false)}>Отмена</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}