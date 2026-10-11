const { cancelTicket } = require('../services/cancellationService');

async function cancelTicketController(req, res) {
  try {
    const { ticketId, pnr, passengerIds, passengers, cancellationTimestamp } = req.body;
    if (!ticketId && !pnr) return res.status(400).json({ success: false, message: 'ticketId or pnr is required.' });
    const result = await cancelTicket({
      ticketId: ticketId || pnr,
      passengerIds: passengerIds || passengers?.map((passenger) => passenger._id || passenger.id),
      cancellationTimestamp,
      userId: req.user?._id || req.user?.id,
    });
    return res.status(200).json({ success: true, message: 'Ticket cancelled and queue updated.', refundAmount: result.refundAmount, deduction: result.deduction, data: result });
  } catch (error) {
    const status = /not found/.test(error.message) ? 404 : /cannot cancel|30 minutes|four hours|cannot cancel this/.test(error.message) ? 400 : 500;
    return res.status(status).json({ success: false, message: error.message });
  }
}

module.exports = { cancelTicketController };
