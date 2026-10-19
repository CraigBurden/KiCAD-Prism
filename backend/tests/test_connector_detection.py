"""The connector rule order System Builder v2 keeps from v1 (``connector_detection``)."""

from __future__ import annotations

import unittest

from app.services.systems import connector_detection


class ConnectorDetectionTest(unittest.TestCase):
    def test_rule_order(self) -> None:
        classify = connector_detection.classify
        self.assertEqual(classify("U1", "MCU:X", "", {"System": "Connector"}), (True, "field"))
        self.assertEqual(classify("J1", "Connector:Y", "", {"Prism_Port": "No"}), (False, "field"))
        self.assertEqual(classify("U2", "Mine:Z", "", {"prism port": "PORT"}), (True, "field"))
        self.assertEqual(classify("J3", "Mine:Z", "", {}), (True, "refdes"))
        # v1.10: only J. X is usually an oscillator; P and CN need a Connector library.
        self.assertEqual(classify("X1", "Oscillator:ASE", "", {}), (False, "none"))
        self.assertEqual(classify("CN3", "Mine:Z", "", {}), (False, "none"))
        self.assertEqual(classify("P2", "Connector_Generic:Conn_01x04", "", {}), (True, "library"))
        self.assertEqual(classify("JP1", "Jumper:J", "", {}), (False, "none"))
        self.assertEqual(classify("PS1", "Power:P", "", {}), (False, "none"))
        self.assertEqual(classify("U4", "Connector_Audio:J", "", {}), (True, "library"))
        self.assertEqual(classify("U5", "Mine:Z", "connector_custom:FP", {}), (True, "library"))
        self.assertEqual(classify("U6", "Mine:Z", "", {"Prism_Port": "maybe"}), (False, "none"))
        # v1.9: KiCad's test points live in the Connector library but are not ports,
        # unless a field says so.
        self.assertEqual(classify("TP1", "Connector:TestPoint", "TestPoint:TestPoint_Pad_D1.0mm", {}),
                         (False, "none"))
        self.assertEqual(classify("TP2", "Connector:TestPoint_2Pole", "Connector_Custom:TP", {}),
                         (False, "none"))
        self.assertEqual(classify("TP3", "Connector:TestPoint", "", {"Prism_Port": "yes"}), (True, "field"))
