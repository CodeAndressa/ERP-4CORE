import unittest

from app.services.asaas_service import build_topdata_access_alerts


class TopdataAccessAlertsTests(unittest.TestCase):
    def test_alert_starts_only_after_ten_days(self):
        result = build_topdata_access_alerts([
            {'id': 'ten', 'customer_id': 'cus_1', 'customer': 'Cliente A', 'status': 'OVERDUE', 'days_overdue': 10, 'value': 100},
            {'id': 'eleven', 'customer_id': 'cus_2', 'customer': 'Cliente B', 'status': 'OVERDUE', 'days_overdue': 11, 'value': 200},
        ])

        self.assertEqual(result['total_clients'], 1)
        self.assertEqual(result['items'][0]['customer'], 'Cliente B')

    def test_groups_multiple_charges_by_customer(self):
        result = build_topdata_access_alerts([
            {'id': 'one', 'customer_id': 'cus_1', 'customer': 'Cliente A', 'status': 'OVERDUE', 'days_overdue': 12, 'due_date': '2026-08-29', 'value': 100.50},
            {'id': 'two', 'customer_id': 'cus_1', 'customer': 'Cliente A', 'status': 'OVERDUE', 'days_overdue': 20, 'due_date': '2026-08-21', 'value': 250},
            {'id': 'paid', 'customer_id': 'cus_1', 'customer': 'Cliente A', 'status': 'RECEIVED', 'days_overdue': 30, 'due_date': '2026-08-11', 'value': 999},
        ])

        self.assertEqual(result['total_clients'], 1)
        self.assertEqual(result['total_charges'], 2)
        self.assertEqual(result['total_value'], 350.50)
        self.assertEqual(result['items'][0]['days_overdue'], 20)
        self.assertEqual(result['items'][0]['oldest_due_date'], '2026-08-21')
        self.assertEqual(result['items'][0]['charge_ids'], ['one', 'two'])

    def test_blocked_customer_is_not_requested_twice(self):
        result = build_topdata_access_alerts(
            [{'id': 'one', 'customer_id': 'cus_1', 'customer': 'Cliente A', 'status': 'OVERDUE', 'days_overdue': 12, 'value': 100}],
            access_controls=[{'customer_id': 'cus_1', 'customer': 'Cliente A', 'status': 'blocked', 'charge_ids': '["one"]'}],
        )

        self.assertEqual(result['total_clients'], 0)
        self.assertEqual(result['total_blocked_clients'], 1)
        self.assertEqual(result['total_unblock_clients'], 0)

    def test_paid_blocked_customer_requires_manual_unblock(self):
        result = build_topdata_access_alerts(
            [{
                'id': 'one', 'customer_id': 'cus_1', 'customer': 'Cliente A',
                'status': 'RECEIVED', 'days_overdue': 0, 'payment_date': '2026-09-10', 'value': 100,
            }],
            access_controls=[{'customer_id': 'cus_1', 'customer': 'Cliente A', 'status': 'blocked', 'charge_ids': '["one"]'}],
        )

        self.assertEqual(result['total_clients'], 0)
        self.assertEqual(result['total_unblock_clients'], 1)
        self.assertEqual(result['unblock_items'][0]['payment_date'], '2026-09-10')
        self.assertEqual(result['unblock_items'][0]['paid_value'], 100)

    def test_does_not_request_unblock_while_another_charge_is_overdue(self):
        result = build_topdata_access_alerts(
            [
                {'id': 'paid', 'customer_id': 'cus_1', 'customer': 'Cliente A', 'status': 'RECEIVED', 'days_overdue': 0, 'value': 100},
                {'id': 'still-overdue', 'customer_id': 'cus_1', 'customer': 'Cliente A', 'status': 'OVERDUE', 'days_overdue': 2, 'value': 50},
            ],
            access_controls=[{'customer_id': 'cus_1', 'customer': 'Cliente A', 'status': 'blocked', 'charge_ids': '["paid"]'}],
        )

        self.assertEqual(result['total_unblock_clients'], 0)


if __name__ == '__main__':
    unittest.main()
