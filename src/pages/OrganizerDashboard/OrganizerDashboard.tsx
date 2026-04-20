import { useEffect, useState } from 'react'
import { FormEvent } from 'react'
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

    const handleCreate = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault()

        const userString = localStorage.getItem('user')
        if (!userString) return
        const user: AppUser = JSON.parse(userString)

        const formData = new FormData(e.currentTarget)

        const { error } = await supabase.from('tournaments').insert([{
            title: formData.get('title'),
            city: formData.get('city'),
            start_datetime: formData.get('start_datetime'),
            end_datetime: formData.get('end_datetime'),
            time_control: formData.get('time_control'),
            total_spots: parseInt(formData.get('total_spots') as string),
            total_rounds: parseInt(formData.get('total_rounds') as string),
            organizer_id: user.id
        }])

        if (error) {
            alert('Ошибка при создании: ' + error.message)
            return
        }

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
                                <input name="start_datetime" type="datetime-local" required title="Дата и время начала" />
                                <input name="end_datetime" type="datetime-local" required title="Дата и время окончания" />
                                <select name="time_control" required>
                                    <option value="блиц">Блиц</option>
                                    <option value="рапид">Рапид</option>
                                    <option value="классика">Классика</option>
                                </select>
                                <input name="total_spots" type="number" placeholder="Всего мест" required min="2" />
                                <input name="total_rounds" type="number" placeholder="Количество туров" required min="1" />
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